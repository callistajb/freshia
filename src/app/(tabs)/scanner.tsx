import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- IMPORT FIREBASE ---
import { addDoc, collection } from "firebase/firestore";
import { saveScanResult } from "../../services/firestoreService";
import { auth, db } from "../../firebaseConfig";

// --- PENGATURAN MODEL GEMINI ---
const GEMINI_MODELS: string[] = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  process.env.EXPO_PUBLIC_GEMINI_MODEL || "",
].filter((name, index, list) => Boolean(name) && list.indexOf(name) === index);

// Membuat fingerprint deterministik dari konten gambar Base64 agar foto yang sama persis selalu menghasilkan persentase kesegaran yang 100% konsisten
const computeImageFingerprint = (rawBase64: string): string => {
  const clean = rawBase64.trim();
  const len = clean.length;
  let hash1 = 2166136261;
  let hash2 = 2166136261;
  const step = Math.max(1, Math.floor(len / 512));
  for (let i = 0; i < len; i += step) {
    const code = clean.charCodeAt(i);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 16777619);
    hash2 ^= clean.charCodeAt(len - 1 - i);
    hash2 = Math.imul(hash2, 16777619);
  }
  return `fp_${len}_${(hash1 >>> 0).toString(16)}_${(hash2 >>> 0).toString(16)}`;
};

// Kompres gambar ke Base64 kecil agar permanen disimpan di AsyncStorage & Firestore (maks 1MB/dokumen)
const createPersistentThumbnail = async (
  uri: string,
  rawBase64: string,
): Promise<string> => {
  const fallbackDataUrl = `data:image/jpeg;base64,${rawBase64}`;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.55));
        } else {
          resolve(fallbackDataUrl);
        }
      };
      img.onerror = () => resolve(fallbackDataUrl);
      img.src = uri.startsWith("data:") ? uri : fallbackDataUrl;
    });
  }

  return fallbackDataUrl;
};

const uploadToCloudinary = async (base64String: string) => {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Kredensial Cloudinary belum diatur di .env");
  }

  const fileData = `data:image/jpeg;base64,${base64String}`;
  const data = new FormData();
  data.append("file", fileData);
  data.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: data,
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || "Gagal upload ke Cloudinary");
  }
  return result.secure_url;
};

const callGeminiModel = async (
  model: string,
  apiKey: string,
  prompt: string,
  base64Image: string,
) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              detectedFruitName: { type: "STRING" },
              freshnessPercentage: { type: "NUMBER" },
              salvageValue: { type: "STRING" },
              shelfLife: { type: "STRING" },
              recipe: { type: "STRING" },
            },
            required: [
              "detectedFruitName",
              "freshnessPercentage",
              "salvageValue",
              "shelfLife",
              "recipe",
            ],
          },
        },
      }),
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      const timeoutErr: any = new Error("Waktu tunggu Gemini habis (timeout)");
      timeoutErr.status = 503;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();

  if (!response.ok) {
    const error: any = new Error(
      data?.error?.message || `Gemini mengembalikan error ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }

  if (data?.promptFeedback?.blockReason) {
    throw new Error(
      `Permintaan diblokir oleh Gemini (${data.promptFeedback.blockReason})`,
    );
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const textResponse = Array.isArray(parts)
    ? parts
        .filter((part: any) => typeof part.text === "string" && !part.thought)
        .map((part: any) => part.text)
        .join("")
    : "";

  if (!textResponse) {
    throw new Error("Gemini tidak mengembalikan jawaban (respons kosong).");
  }

  const cleanJsonString = textResponse
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  const result = JSON.parse(cleanJsonString);

  const freshness = Number.parseFloat(String(result.freshnessPercentage));
  return {
    detectedFruitName: String(result.detectedFruitName ?? "").trim(),
    freshnessPercentage: Number.isNaN(freshness)
      ? 0
      : Math.min(100, Math.max(0, Math.round(freshness))),
    salvageValue: String(result.salvageValue ?? "-"),
    shelfLife: String(result.shelfLife ?? "-"),
    recipe: String(result.recipe ?? "-"),
  };
};

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const router = useRouter();

  // State foto yang baru dijepret / dipilih
  const [capturedPhoto, setCapturedPhoto] = useState<{
    uri: string;
    base64: string;
  } | null>(null);

  // State Mode & Input sesuai Figma (Bisnis / Pribadi)
  const [defaultModePref, setDefaultModePref] = useState<
    "Bisnis" | "Pribadi" | null
  >(null);
  const [selectedMode, setSelectedMode] = useState<"Bisnis" | "Pribadi" | null>(
    null,
  );
  const [panjang, setPanjang] = useState("");
  const [lebar, setLebar] = useState("");
  const [tinggi, setTinggi] = useState("");
  const [berat, setBerat] = useState("");
  const [jumlahBuah, setJumlahBuah] = useState("");
  const [inputTypePribadi, setInputTypePribadi] = useState<
    "jumlah" | "berat"
  >("jumlah");

  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sinkronisasi Mode Scan Default dari halaman Profile (@freshia_default_mode)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const savedMode = await AsyncStorage.getItem("@freshia_default_mode");
          if (!active) return;
          if (savedMode === "Bisnis" || savedMode === "Pribadi") {
            setDefaultModePref(savedMode);
            setSelectedMode(savedMode);
          }
        } catch {}
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // 1. Fungsi Jepret Foto dari Kamera
  const handleCapturePhoto = async () => {
    if (!cameraRef.current || isCapturing || isProcessing) return;
    setIsCapturing(true);

    try {
      if (Platform.OS === "android") {
        await SystemUI.setBackgroundColorAsync("black");
      }

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.4,
        shutterSound: false,
      });

      if (!photo?.base64) {
        throw new Error("Gagal mendapatkan data gambar dari kamera.");
      }

      const rawBase64 = photo.base64.includes(",")
        ? photo.base64.split(",")[1]
        : photo.base64;

      const persistentUri = await createPersistentThumbnail(
        photo.uri,
        rawBase64,
      );

      setCapturedPhoto({
        uri: persistentUri,
        base64: rawBase64,
      });
    } catch (err: any) {
      console.error("Capture Error:", err);
      showAlert(
        "Gagal Mengambil Foto",
        "Pastikan kamera aktif atau gunakan tombol Galeri di samping tombol merah.",
      );
    } finally {
      setIsCapturing(false);
    }
  };

  // 1B. Alternatif Pilih Foto dari Galeri (Sangat membantu di Web/Laptop atau stok foto)
  const handlePickFromGallery = async () => {
    if (isCapturing || isProcessing) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const rawBase64 = asset.base64.includes(",")
            ? asset.base64.split(",")[1]
            : asset.base64;

          const persistentUri = await createPersistentThumbnail(
            asset.uri,
            rawBase64,
          );

          setCapturedPhoto({
            uri: persistentUri,
            base64: rawBase64,
          });
        }
      }
    } catch (err) {
      console.error("Gallery Error:", err);
      showAlert("Gagal", "Tidak dapat membuka galeri gambar.");
    }
  };

  // Reset foto ("Ulangi Gambar")
  const handleRetake = () => {
    setCapturedPhoto(null);
    setSelectedMode(defaultModePref);
    setPanjang("");
    setLebar("");
    setTinggi("");
    setBerat("");
    setJumlahBuah("");
    setInputTypePribadi("jumlah");
  };

  // Simpan ke history lokal (AsyncStorage)
  const saveToHistory = async (photoUri: string, detectionResult: any) => {
    const entryId = Date.now().toString();
    try {
      const newEntry = {
        id: entryId,
        userId: auth.currentUser?.uid || "guest",
        date: new Date().toLocaleString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        image: photoUri,
        mode: selectedMode || "Pribadi",
        result: detectionResult,
      };

      const existingHistory = await AsyncStorage.getItem("@freshia_history");
      const historyArray = existingHistory ? JSON.parse(existingHistory) : [];
      historyArray.unshift(newEntry);
      // Batasi history maks 50 entry untuk mencegah CursorWindow overflow pada Android
      const trimmedHistory = historyArray.slice(0, 50);
      await AsyncStorage.setItem(
        "@freshia_history",
        JSON.stringify(trimmedHistory),
      );
    } catch (e) {
      console.error("Gagal menyimpan ke history lokal", e);
    }
    return entryId;
  };

  // Tautkan ID Firestore ke entri lokal
  const linkFirestoreId = async (entryId: string, firestoreId: string) => {
    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      const arr = stored ? JSON.parse(stored) : [];
      const updated = arr.map((item: any) =>
        item.id === entryId ? { ...item, firestoreId } : item,
      );
      await AsyncStorage.setItem("@freshia_history", JSON.stringify(updated));
    } catch (e) {
      console.warn("Gagal menautkan ID Firestore", e);
    }
  };

  // Panggil Gemini API dengan analisis visual murni & rubrik penilaian ketat
  const analyzeWithGemini = async (base64Image: string) => {
    const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API Key belum diatur di .env");
    }

    const detailParameter =
      selectedMode === "Bisnis"
        ? `Mode Bisnis (stok komersial/keranjang). Dimensi wadah: Panjang ${panjang || "-"} cm, Lebar ${lebar || "-"} cm, Tinggi ${tinggi || "-"} cm.`
        : `Mode Pribadi (konsumsi rumah tangga). ${jumlahBuah ? `Jumlah buah: ${jumlahBuah} buah.` : ""} ${berat ? `Estimasi berat buah: ${berat} gram/kg.` : ""} ${!jumlahBuah && !berat ? "Tidak ada info berat/jumlah." : ""}`;

    const prompt = `Kamu adalah ahli agronomi dan botani buah profesional untuk aplikasi Freshia.
Analisis gambar buah ini secara visual murni dari nol.
Parameter pengguna: ${detailParameter}

ATURAN PENILAIAN WAJIB:
1. VALIDASI OBJEK BUKAN BUAH:
   - Jika foto berisi benda mati, tembok, wajah, layar, teks, atau bukan buah sama sekali: kembalikan "detectedFruitName": "Bukan Buah", "freshnessPercentage": 0, "salvageValue": "Rp0", "shelfLife": "0 hari", dan "recipe": "Tidak ada buah yang terdeteksi dalam gambar.".

2. IDENTIFIKASI NAMA BUAH SPESIFIK (TERMASUK BUAH LANGKA/EKSOTIS):
   - Amati ciri botani kulit, bentuk, dan tangkai secara teliti.
   - Buah berkulit keras/berkayu kuning kecokelatan berbentuk bulat dengan bercak alami seperti Bael (Maja / Aegle marmelos) WAJIB dinamai "Buah Bael (Maja)", JANGAN disebut Kedondong atau Jeruk.
   - Tulis nama buah yang paling tepat dalam Bahasa Indonesia (contoh: "Buah Bael (Maja)", "Pisang", "Apel Merah", "Kedondong", "Sawo", "Srikaya").

3. RUBRIK PENILAIAN KESEGARAN VISUAL KETAT (0 - 100):
   - 85% - 100% (Sangat Segar): Kulit mulus, warna cerah seragam, tangkai hijau/kokoh, tanpa memar, retak, atau bercak cokelat.
   - 65% - 84% (Segar / Matang Siap Konsumsi): Buah matang optimal dengan kulit kencang. Pada pisang, hanya boleh ada bintik cokelat sangat kecil terpisah (<10% permukaan kulit) dan tangkai masih kuning/hijau.
   - 40% - 64% (Menurun / Harus Segera Diolah): Kulit mulai kusam, keriput ringan, bercak cokelat mulai melebar (15% - 30% permukaan), atau ujung tangkai mulai mengering/menghitam. Sisa masa simpan maksimal 1 hari.
   - 1% - 39% (Tidak Segar / Hampir Busuk / Busuk): Bercak cokelat/hitam sudah melebar dan menyatu (>30% permukaan kulit seperti pisang terlalu matang/busuk), tangkai hitam layu, kulit lembek berair, retak, atau berjamur. Wajib beri skor di bawah 35% dan masa simpan "Hari ini terakhir".

4. KALKULASI EKONOMI & MASA SIMPAN:
   - "salvageValue": Jika Mode Bisnis, hitung estimasi harga jual wajar & estimasi keuntungan dalam format "Rp25.000 | Rp8.000" berdasarkan dimensi wadah (P x L x T) atau kondisi buah. Jika Mode Pribadi, tulis estimasi nilai ekonomisnya seperti "Rp15.000" (turunkan drastis jika skor < 40%).
   - "shelfLife": Prediksi sisa hari layak konsumsi (contoh: "4 - 5 hari lagi", "1 hari lagi", atau "Hari ini terakhir").
   - "recipe": Berikan 2 ide olahan resep zero-waste singkat sesuai jenis buahnya (jika hampir busuk, sarankan olahan matang seperti bolu pisang/smoothie; jika masih segar, sarankan olahan segar) dengan format "Nama Resep 1: deskripsi singkat\nNama Resep 2: deskripsi singkat".

Kembalikan respons MURNI dalam format JSON sesuai schema tanpa markdown backticks.`;

    let lastError: any = null;
    for (const model of GEMINI_MODELS) {
      try {
        return await callGeminiModel(
          model,
          GEMINI_API_KEY,
          prompt,
          base64Image,
        );
      } catch (err: any) {
        lastError = err;
        console.log(`Gemini (${model}) gagal: ${err.message}`);
        if (![400, 404, 429, 500, 503].includes(err.status)) break;
      }
    }
    throw lastError;
  };

  // 2. Proses Analisis AI & Penyimpanan ke AsyncStorage + Cloudinary + Firestore
  const handleAnalyzePhoto = async () => {
    if (!capturedPhoto) {
      showAlert("Belum Ada Foto", "Silakan jepret atau pilih foto buah dulu.");
      return;
    }
    if (!selectedMode) {
      showAlert(
        "Pilih Mode",
        "Pilih mode 'Bisnis' atau 'Pribadi' terlebih dahulu sebelum menganalisis.",
      );
      return;
    }

    setIsProcessing(true);

    try {
      const rawBase64 = capturedPhoto.base64;

      // A. ROBOFLOW DETECTION
      const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
      const modelId = process.env.EXPO_PUBLIC_ROBOFLOW_MODEL_ID;
      const apiUrl = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}`;

      let rawClass = "Buah";
      let confidenceScore = "0";

      if (apiKey && modelId) {
        try {
          const roboResponse = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: rawBase64,
          });
          const roboData = await roboResponse.json();
          if (roboData.predictions && roboData.predictions.length > 0) {
            rawClass = roboData.predictions[0].class;
            confidenceScore = (
              roboData.predictions[0].confidence * 100
            ).toFixed(1);
          }
        } catch {
          rawClass = "Buah";
        }
      }

      // B. GEMINI ANALYSIS (dengan 1x retry otomatis jika 503 high demand & fallback cerdas ke Roboflow)
      let geminiAnalysis = null;
      try {
        try {
          geminiAnalysis = await analyzeWithGemini(rawBase64);
        } catch (firstErr: any) {
          if (firstErr?.status === 503 || firstErr?.status === 429) {
            await new Promise((r) => setTimeout(r, 1200));
            geminiAnalysis = await analyzeWithGemini(rawBase64);
          } else {
            throw firstErr;
          }
        }

        if (
          geminiAnalysis.detectedFruitName &&
          geminiAnalysis.detectedFruitName.toLowerCase() !== "bukan buah"
        ) {
          rawClass = geminiAnalysis.detectedFruitName;
        } else if (
          geminiAnalysis.detectedFruitName?.toLowerCase() === "bukan buah"
        ) {
          rawClass = "Buah";
        }
      } catch (err: any) {
        console.warn("Gemini Error (High Demand):", err.message);
        const lowerRoboflow = rawClass.toLowerCase();
        const isUnfreshFromRoboflow =
          lowerRoboflow.includes("unfresh") ||
          lowerRoboflow.includes("rotten") ||
          lowerRoboflow.includes("busuk");

        if (rawClass !== "Buah" && Number(confidenceScore) > 30) {
          const cleanName =
            rawClass
              .replace(/fresh|unfresh|rotten|banana/gi, (m) =>
                m.toLowerCase() === "banana" ? "Pisang" : "",
              )
              .trim() || "Buah";
          rawClass = cleanName;
          geminiAnalysis = {
            detectedFruitName: cleanName,
            freshnessPercentage: isUnfreshFromRoboflow ? 25 : 80,
            salvageValue: isUnfreshFromRoboflow ? "Rp5.000" : "Rp15.000",
            shelfLife: isUnfreshFromRoboflow
              ? "Hari ini terakhir"
              : "4 - 5 hari lagi",
            recipe: isUnfreshFromRoboflow
              ? "Bolu Kukus Buah: Haluskan buah matang untuk campuran adonan kue\nSmoothie Dingin: Blender dengan susu dan es batu"
              : "Salad Buah Segar: Potong dadu dan sajikan dingin\nJus Alami: Blender dengan sedikit madu",
          };
        } else {
          showAlert(
            "Server AI Sedang Sibuk",
            "Server Gemini sedang mengalami lonjakan trafik (503). Silakan tekan tombol Analisis sekali lagi.",
          );
          return;
        }
      }

      // C. SIMPAN KE HISTORY LOKAL (AsyncStorage dengan Base64 permanen)
      const entryId = await saveToHistory(capturedPhoto.uri, {
        label: rawClass,
        confidence: confidenceScore,
        analysis: geminiAnalysis,
      });

      // D. LANGSUNG PINDAH KE HALAMAN RESULT
      router.push({
        pathname: "/result",
        params: {
          detection: rawClass,
          mode: selectedMode,
          imageUri: capturedPhoto.uri,
          analysis: JSON.stringify(geminiAnalysis),
        },
      });

      // E. UPLOAD CLOUDINARY (OPSIONAL) & SIMPAN PERMANEN KE FIRESTORE (Base64 fallback)
      const currentUserId = auth.currentUser?.uid || null;
      const metadataInput =
        selectedMode === "Bisnis" ? { panjang, lebar, tinggi } : { berat, jumlahBuah };

      (async () => {
        try {
          let finalImageUrl = capturedPhoto.uri;
          try {
            finalImageUrl = await uploadToCloudinary(rawBase64);
          } catch (cloudErr) {
            console.warn(
              "Cloudinary dilewati (cek .env), lanjut simpan Base64 ke Firestore:",
              cloudErr,
            );
          }

          const firestoreId = await saveScanResult({
            userId: currentUserId,
            imageUrl: finalImageUrl,
            label: rawClass,
            confidence: confidenceScore,
            analysis: geminiAnalysis,
            mode: selectedMode || "Pribadi",
            parameters: metadataInput,
          });

          await linkFirestoreId(entryId, firestoreId);
          console.log("Berhasil tersimpan ke Firestore ID:", firestoreId);
        } catch (dbError) {
          console.warn("Gagal menyimpan ke Firestore:", dbError);
        }
      })();
    } catch (error) {
      console.error(error);
      showAlert("Gagal", "Terjadi kesalahan saat memproses gambar.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={54} color="#C8201B" />
        <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
        <Text style={styles.permissionDesc}>
          Freshia memerlukan akses kamera untuk memindai tingkat kesegaran buah
          Anda.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.85}
        >
          <Text style={styles.permissionButtonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.galleryFallbackBtn}
          onPress={handlePickFromGallery}
          activeOpacity={0.85}
        >
          <Text style={styles.galleryFallbackText}>
            Atau Pilih Foto dari Galeri
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* BAGIAN ATAS: LIVE CAMERA PREVIEW */}
      <View style={styles.cameraSection}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef} />

        {/* Overlay Header & Panduan (pointerEvents="box-none" agar tidak memblokir klik) */}
        <View style={styles.cameraOverlay} pointerEvents="box-none">
          {/* Top Navigation Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={() => router.push("/(tabs)")}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={() =>
                showAlert(
                  "Panduan Scan Buah",
                  "1. Arahkan kamera ke buah atau pilih foto dari galeri.\n2. Tekan tombol merah di tengah untuk menjepret.\n3. Pilih mode Bisnis atau Pribadi lalu tekan Analisis.",
                )
              }
              activeOpacity={0.8}
            >
              <Ionicons name="help-circle-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Instruksi Tengah Kamera */}
          <View style={styles.centerGuide} pointerEvents="none">
            <Text style={styles.scanTitle}>Scan Buah</Text>
            <Text style={styles.scanSubtitle}>
              Arahkan kamera pada buah Anda
            </Text>
            <View style={styles.viewfinderFrame}>
              <Ionicons
                name="camera-outline"
                size={54}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </View>
        </View>
      </View>

      {/* BAGIAN BAWAH: PANEL PUTIH MELENGKUNG (BOTTOM SHEET) */}
      <View style={styles.bottomSheet}>
        {/* Tombol Bulat Merah Utama di Tengah Perbatasan (Jepret Foto) */}
        <TouchableOpacity
          style={styles.shutterButton}
          onPress={handleCapturePhoto}
          disabled={isCapturing || isProcessing}
          activeOpacity={0.85}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons
              name="line-scan"
              size={30}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        {/* Tombol Kecil Pilih dari Galeri di Kiri Atas Panel */}
        <TouchableOpacity
          style={styles.galleryMiniBtn}
          onPress={handlePickFromGallery}
          disabled={isCapturing || isProcessing}
          activeOpacity={0.8}
        >
          <Ionicons name="images-outline" size={16} color="#9A1B17" />
          <Text style={styles.galleryMiniText}>Galeri</Text>
        </TouchableOpacity>

        {/* Tombol Ulangi Gambar di Kanan Atas Panel */}
        {capturedPhoto && (
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={handleRetake}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeText}>Ulangi Gambar</Text>
            <Ionicons name="refresh" size={15} color="#1C1C1E" />
          </TouchableOpacity>
        )}

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Kotak Pratinjau Foto Hasil Jepretan */}
          {capturedPhoto ? (
            <View style={styles.previewWrapper}>
              <Image
                source={{ uri: capturedPhoto.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyPreviewBox}
              onPress={handleCapturePhoto}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={28} color="#9A1B17" />
              <Text style={styles.emptyPreviewText}>
                Tekan tombol merah di atas untuk menjepret buah, atau pilih dari
                Galeri
              </Text>
            </TouchableOpacity>
          )}

          {/* Pilihan Mode: Bisnis / Pribadi */}
          <Text style={styles.modeQuestion}>Mode apa yang ingin digunakan</Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modePill,
                selectedMode === "Bisnis" && styles.modePillActive,
              ]}
              onPress={() => setSelectedMode("Bisnis")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modePillText,
                  selectedMode === "Bisnis" && styles.modePillTextActive,
                ]}
              >
                Bisnis
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modePill,
                selectedMode === "Pribadi" && styles.modePillActive,
              ]}
              onPress={() => setSelectedMode("Pribadi")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modePillText,
                  selectedMode === "Pribadi" && styles.modePillTextActive,
                ]}
              >
                Pribadi
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input Dinamis Berdasarkan Mode Sesuai Figma */}
          {selectedMode === "Bisnis" && (
            <View style={styles.dimensionRow}>
              <View style={styles.dimensionCol}>
                <Text style={styles.inputLabel}>Panjang</Text>
                <TextInput
                  style={styles.dimensionInput}
                  placeholder="cm"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={panjang}
                  onChangeText={setPanjang}
                />
              </View>

              <View style={styles.dimensionCol}>
                <Text style={styles.inputLabel}>Lebar</Text>
                <TextInput
                  style={styles.dimensionInput}
                  placeholder="cm"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={lebar}
                  onChangeText={setLebar}
                />
              </View>

              <View style={styles.dimensionCol}>
                <Text style={styles.inputLabel}>Tinggi</Text>
                <TextInput
                  style={styles.dimensionInput}
                  placeholder="cm"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={tinggi}
                  onChangeText={setTinggi}
                />
              </View>
            </View>
          )}

          {selectedMode === "Pribadi" && (
            <View style={styles.weightContainer}>
              {/* Toggle: Jumlah Buah vs Berat */}
              <View style={styles.inputToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.inputTogglePill,
                    inputTypePribadi === "jumlah" && styles.inputTogglePillActive,
                  ]}
                  onPress={() => setInputTypePribadi("jumlah")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="fruit-cherries"
                    size={14}
                    color={inputTypePribadi === "jumlah" ? "#9A1B17" : "#A0A0A0"}
                  />
                  <Text
                    style={[
                      styles.inputToggleText,
                      inputTypePribadi === "jumlah" && styles.inputToggleTextActive,
                    ]}
                  >
                    Jumlah Buah
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.inputTogglePill,
                    inputTypePribadi === "berat" && styles.inputTogglePillActive,
                  ]}
                  onPress={() => setInputTypePribadi("berat")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="weight-gram"
                    size={14}
                    color={inputTypePribadi === "berat" ? "#9A1B17" : "#A0A0A0"}
                  />
                  <Text
                    style={[
                      styles.inputToggleText,
                      inputTypePribadi === "berat" && styles.inputToggleTextActive,
                    ]}
                  >
                    Berat
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Input Jumlah Buah */}
              {inputTypePribadi === "jumlah" && (
                <View>
                  <Text style={styles.inputLabel}>Berapa buah yang dimiliki?</Text>
                  <View style={styles.quantityChipsRow}>
                    {["1", "2", "3", "5", "10"].map((qty) => (
                      <TouchableOpacity
                        key={qty}
                        style={[
                          styles.quantityChip,
                          jumlahBuah === qty && styles.quantityChipActive,
                        ]}
                        onPress={() => setJumlahBuah(jumlahBuah === qty ? "" : qty)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quantityChipText,
                            jumlahBuah === qty && styles.quantityChipTextActive,
                          ]}
                        >
                          {qty} buah
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.weightInput}
                    placeholder="Atau ketik jumlah lain..."
                    placeholderTextColor="#A0A0A0"
                    keyboardType="numeric"
                    value={jumlahBuah}
                    onChangeText={setJumlahBuah}
                  />
                </View>
              )}

              {/* Input Berat */}
              {inputTypePribadi === "berat" && (
                <View>
                  <Text style={styles.inputLabel}>Estimasi berat buah</Text>
                  <View style={styles.quantityChipsRow}>
                    {["100g", "250g", "500g", "1kg", "2kg"].map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[
                          styles.quantityChip,
                          berat === w && styles.quantityChipActive,
                        ]}
                        onPress={() => setBerat(berat === w ? "" : w)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quantityChipText,
                            berat === w && styles.quantityChipTextActive,
                          ]}
                        >
                          {w}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.weightInput}
                    placeholder="Atau ketik berat lain (cth: 300 gram)"
                    placeholderTextColor="#A0A0A0"
                    value={berat}
                    onChangeText={setBerat}
                  />
                </View>
              )}
            </View>
          )}

          {/* Tombol Eksekusi Analisis AI */}
          {capturedPhoto && selectedMode && (
            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={handleAnalyzePhoto}
              disabled={isProcessing}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <View style={styles.processingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.analyzeButtonText}>
                    Menganalisis Buah...
                  </Text>
                </View>
              ) : (
                <Text style={styles.analyzeButtonText}>
                  Analisis Kesegaran Buah
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9A1B17",
    marginTop: 14,
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 13.5,
    color: "#555555",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  permissionButton: {
    backgroundColor: "#C8201B",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  galleryFallbackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  galleryFallbackText: {
    color: "#9A1B17",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  /* Kamera Atas */
  cameraSection: {
    height: "47%",
    width: "100%",
    position: "relative",
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingTop: Platform.OS === "ios" ? 50 : 32,
    paddingHorizontal: 18,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  centerGuide: {
    alignItems: "center",
    marginTop: 10,
  },
  scanTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  scanSubtitle: {
    fontSize: 12.5,
    color: "#F2F2F7",
    marginBottom: 18,
  },
  viewfinderFrame: {
    width: 110,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Bottom Sheet Putih */
  bottomSheet: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingTop: 36,
    paddingHorizontal: 20,
    position: "relative",
  },
  shutterButton: {
    position: "absolute",
    top: -32,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#C8201B",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    elevation: 8,
    shadowColor: "#9A1B17",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  galleryMiniBtn: {
    position: "absolute",
    top: 12,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FCE8E8",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    zIndex: 15,
  },
  galleryMiniText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9A1B17",
  },
  retakeBtn: {
    position: "absolute",
    top: 12,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 15,
  },
  retakeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  sheetScroll: {
    flex: 1,
    marginTop: 6,
  },
  sheetScrollContent: {
    paddingBottom: 115,
  },
  previewWrapper: {
    width: "100%",
    height: 155,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F2EAEA",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  emptyPreviewBox: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#E0CACA",
    backgroundColor: "#FCE8E8",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  emptyPreviewText: {
    fontSize: 12,
    color: "#9A1B17",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 17,
  },

  /* Mode Bisnis / Pribadi */
  modeQuestion: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  modePill: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E5DADA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  modePillActive: {
    borderColor: "#9A1B17",
    backgroundColor: "#FFF5F5",
  },
  modePillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#A0A0A0",
  },
  modePillTextActive: {
    color: "#9A1B17",
    fontWeight: "700",
  },

  /* Input Dimensi & Berat */
  dimensionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  dimensionCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  dimensionInput: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E5DADA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 12.5,
    color: "#1C1C1E",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  weightContainer: {
    marginBottom: 16,
  },
  weightInput: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5DADA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 12.5,
    color: "#1C1C1E",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  /* Toggle Jumlah/Berat */
  inputToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  inputTogglePill: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5DADA",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  inputTogglePillActive: {
    borderColor: "#9A1B17",
    backgroundColor: "#FFF5F5",
  },
  inputToggleText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#A0A0A0",
  },
  inputToggleTextActive: {
    color: "#9A1B17",
    fontWeight: "700",
  },
  quantityChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  quantityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5DADA",
    backgroundColor: "#FFFFFF",
  },
  quantityChipActive: {
    borderColor: "#9A1B17",
    backgroundColor: "#FFF0F0",
  },
  quantityChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A0A0A0",
  },
  quantityChipTextActive: {
    color: "#9A1B17",
    fontWeight: "700",
  },

  /* Tombol Analisis */
  analyzeButton: {
    backgroundColor: "#C8201B",
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analyzeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
