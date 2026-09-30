import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

// --- IMPORT FIREBASE ---
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebaseConfig";

// --- PENGATURAN MODEL GEMINI ---
// Model Gemini 1.5 sudah dimatikan Google, sehingga selalu menghasilkan
// error 404 "model not found". Model di bawah masih aktif (dicek September 2026).
// Jika suatu saat Google mematikannya juga, cukup ganti nama model lewat .env
// tanpa mengubah kode ini:
//   EXPO_PUBLIC_GEMINI_MODEL=gemini-3.8-flash
// Setelah mengubah .env, jalankan ulang Expo dengan: npx expo start -c
const GEMINI_MODELS: string[] = [
  process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-3.5-flash-lite",
  "gemini-3.8-flash", // model cadangan jika model pertama gagal
].filter((name, index, list) => list.indexOf(name) === index);

const uploadToCloudinary = async (base64String: string) => {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Kredensial Cloudinary belum diatur di .env");
  }

  // Format base64 agar dikenali sebagai gambar oleh Cloudinary
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

// Memanggil satu model Gemini dan mengembalikan hasil analisis yang sudah dirapikan.
// Jika gagal, error yang dilempar membawa properti `status` (kode HTTP).
const callGeminiModel = async (
  model: string,
  apiKey: string,
  prompt: string,
  base64Image: string,
) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
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
      // Meminta Gemini menjawab langsung dalam format JSON sesuai struktur ini
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            freshnessPercentage: { type: "NUMBER" },
            salvageValue: { type: "STRING" },
            shelfLife: { type: "STRING" },
            recipe: { type: "STRING" },
          },
          required: [
            "freshnessPercentage",
            "salvageValue",
            "shelfLife",
            "recipe",
          ],
        },
      },
    }),
  });

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

  // Jaga-jaga jika jawaban masih dibungkus tanda markdown ```json
  const cleanJsonString = textResponse
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  const result = JSON.parse(cleanJsonString);

  // Pastikan semua field ada dan bertipe benar (Firestore menolak nilai undefined)
  const freshness = Number.parseFloat(String(result.freshnessPercentage));
  return {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUmkmMode, setIsUmkmMode] = useState(false);
  const router = useRouter();

  // Fungsi simpan ke history lokal (AsyncStorage)
  const saveToHistory = async (photoUri: string, detectionResult: any) => {
    try {
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        image: photoUri,
        result: detectionResult,
      };

      const existingHistory = await AsyncStorage.getItem("@freshia_history");
      let historyArray = existingHistory ? JSON.parse(existingHistory) : [];
      historyArray.unshift(newEntry);
      await AsyncStorage.setItem(
        "@freshia_history",
        JSON.stringify(historyArray),
      );
    } catch (e) {
      console.error("Gagal menyimpan ke history lokal", e);
    }
  };

  const analyzeWithGemini = async (
    base64Image: string,
    roboflowLabel: string,
  ) => {
    const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API Key belum diatur di .env");
    }

    // Menggunakan istilah baru yang lebih profesional
    const mode = isUmkmMode
      ? "Komersial (stok jumlah besar)"
      : "Personal (stok kecil)";

    const prompt = `Sistem visi awal mendeteksi gambar ini sebagai: ${roboflowLabel}. 
    Aplikasi saat ini berjalan pada mode: ${mode}.
    Tolong analisis buah ini dan kembalikan response MURNI dalam format JSON (tanpa markdown backticks) dengan struktur berikut:
    {
      "freshnessPercentage": angka (0-100),
      "salvageValue": "string estimasi rupiah",
      "shelfLife": "string prediksi hari",
      "recipe": "string saran resep zero-waste singkat"
    }`;

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
        if (![404, 429, 500, 503].includes(err.status)) break;
      }
    }
    throw lastError;
  };

  const takeAndAnalyzePhoto = async () => {
    if (!cameraRef.current) return;
    setIsProcessing(true);

    try {
      if (Platform.OS === "android") {
        await SystemUI.setBackgroundColorAsync("black");
      }

      // 1. Ambil Foto
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        shutterSound: false,
      });

      // 2. ROBOFLOW DETECTION
      const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
      const modelId = process.env.EXPO_PUBLIC_ROBOFLOW_MODEL_ID;
      const apiUrl = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}`;

      let rawClass = "Unknown";
      let confidenceScore = "0";

      if (apiKey && modelId) {
        try {
          const roboResponse = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: photo.base64,
          });
          const roboData = await roboResponse.json();
          if (roboData.predictions && roboData.predictions.length > 0) {
            rawClass = roboData.predictions[0].class;
            confidenceScore = (
              roboData.predictions[0].confidence * 100
            ).toFixed(1);
          }
        } catch (roboErr) {
          rawClass = "Buah (Deteksi awal dilewati)";
        }
      }

      // 3. GEMINI ANALYSIS
      let geminiAnalysis = null;
      try {
        geminiAnalysis = await analyzeWithGemini(photo.base64, rawClass);
      } catch (err: any) {
        console.warn("Gemini Error: ", err.message);
        geminiAnalysis = {
          freshnessPercentage: 0,
          salvageValue: "Rp0 (Error Gemini)",
          shelfLife: "0 hari",
          recipe: "Analisis AI gagal. Periksa koneksi internet.",
        };
      }

      // 4. SIMPAN KE HISTORY LOKAL (AsyncStorage)
      await saveToHistory(photo.uri, {
        label: rawClass,
        confidence: confidenceScore,
        analysis: geminiAnalysis, // <--- TAMBAHKAN BARIS INI
      });

      // 5. LANGSUNG PINDAH KE HALAMAN HASIL! (UX Tidak Tertahan)
      router.push({
        pathname: "/result",
        params: {
          detection: rawClass,
          analysis: JSON.stringify(geminiAnalysis),
        },
      });

      // 6. JALANKAN UPLOAD CLOUD DI LATAR BELAKANG (Fire-and-forget)
      // Tanpa perintah "await" di depannya, fungsi ini tidak akan memblokir aplikasi
      (async () => {
        try {
          const cloudinaryUrl = await uploadToCloudinary(photo.base64);
          await addDoc(collection(db, "scan_history"), {
            imageUrl: cloudinaryUrl,
            label: rawClass,
            confidence: confidenceScore,
            analysis: geminiAnalysis,
            mode: isUmkmMode ? "Komersial" : "Personal",
            timestamp: new Date(),
          });
          console.log("Background Task: Berhasil disimpan ke Firebase!");
        } catch (dbError) {
          console.warn("Background Task Gagal: ", dbError);
        }
      })();
    } catch (error) {
      console.error(error);
      Alert.alert("Gagal", "Koneksi terputus saat mengambil foto.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.containerCentered}>
        <Text style={styles.textInfo}>Freshia butuh izin kamera.</Text>
        <Button
          onPress={requestPermission}
          title="Berikan Izin"
          color="#2e7d32"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.modeText}>
          Mode: {isUmkmMode ? "UMKM" : "Rumah Tangga"}
        </Text>
        <Switch
          value={isUmkmMode}
          onValueChange={setIsUmkmMode}
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isUmkmMode ? "#2e7d32" : "#f4f3f4"}
        />
      </View>

      <CameraView style={styles.camera} facing="back" ref={cameraRef} />

      <View style={styles.overlay}>
        <View style={styles.scanArea} />
      </View>

      <View style={styles.buttonContainer}>
        {isProcessing ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#00E676" />
            <Text style={styles.loadingText}>
              Menganalisis dan Menyimpan...
            </Text>
          </View>
        ) : (
          <Button
            title="✨ Pindai AI"
            color="#2e7d32"
            onPress={takeAndAnalyzePhoto}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  containerCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textInfo: { textAlign: "center", marginBottom: 20 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 10,
  },
  modeText: { color: "white", fontSize: 16, fontWeight: "bold" },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: { width: 250, height: 250, borderWidth: 2, borderColor: "#00E676" },
  buttonContainer: { position: "absolute", bottom: 40, alignSelf: "center" },
  loadingWrapper: { alignItems: "center" },
  loadingText: { color: "#00E676", marginTop: 10, fontWeight: "bold" },
});
