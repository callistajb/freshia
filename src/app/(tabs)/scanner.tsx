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

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUmkmMode, setIsUmkmMode] = useState(false);
  const router = useRouter();

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

    const mode = isUmkmMode
      ? "UMKM (stok jumlah besar)"
      : "Rumah Tangga (stok kecil)";

    const prompt = `Sistem visi awal mendeteksi gambar ini sebagai: ${roboflowLabel}. 
    Aplikasi saat ini berjalan pada mode: ${mode}.
    Tolong analisis buah ini dan kembalikan response MURNI dalam format JSON (tanpa markdown backticks) dengan struktur berikut:
    {
      "freshnessPercentage": angka (0-100),
      "salvageValue": "string estimasi rupiah",
      "shelfLife": "string prediksi hari",
      "recipe": "string saran resep zero-waste singkat"
    }`;

    // PERBAIKAN 1: Menggunakan model gemini-1.5-flash yang dijamin stabil dan cepat
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const textResponse = data.candidates[0].content.parts[0].text;

    // PERBAIKAN 2: Menggunakan Regex yang kuat untuk mengekstrak hanya objek JSON
    // Ini mencegah error jika Gemini membalas dengan teks tambahan sebelum/sesudah JSON
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        "Gemini tidak mengembalikan format JSON yang dapat dibaca.",
      );
    }

    return JSON.parse(jsonMatch[0]);
  };

  const takeAndAnalyzePhoto = async () => {
    if (!cameraRef.current) return;
    setIsProcessing(true);

    try {
      if (Platform.OS === "android") {
        await SystemUI.setBackgroundColorAsync("black");
      }

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        shutterSound: false,
      });

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
          console.warn("Roboflow gagal, lanjut ke Gemini...", roboErr);
          rawClass = "Buah (Deteksi Roboflow Gagal)";
        }
      } else {
        rawClass = "Buah (API Key Roboflow Kosong)";
      }

      let geminiAnalysis = null;
      try {
        geminiAnalysis = await analyzeWithGemini(photo.base64, rawClass);
      } catch (err: any) {
        console.warn("Gemini Error: ", err.message);
        geminiAnalysis = {
          freshnessPercentage: 0,
          salvageValue: "Rp0 (Error)",
          shelfLife: "0 hari",
          recipe: "Analisis AI gagal memproses gambar.",
        };
      }

      try {
        const cloudinaryUrl = await uploadToCloudinary(photo.base64);

        await addDoc(collection(db, "scan_history"), {
          imageUrl: cloudinaryUrl,
          label: rawClass,
          confidence: confidenceScore,
          analysis: geminiAnalysis,
          mode: isUmkmMode ? "UMKM" : "Rumah Tangga",
          timestamp: new Date(),
        });
        console.log("Berhasil disimpan ke Firebase & Cloudinary!");
      } catch (dbError) {
        console.warn("Gagal simpan ke Cloud/Firebase: ", dbError);
      }

      await saveToHistory(photo.uri, {
        label: rawClass,
        confidence: confidenceScore,
      });

      router.push({
        pathname: "/result",
        params: {
          detection: rawClass,
          analysis: JSON.stringify(geminiAnalysis),
        },
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Gagal", "Koneksi terputus atau gagal memproses.");
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
  loadingWrapper: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 15,
    borderRadius: 10,
  },
  loadingText: { color: "#00E676", marginTop: 10, fontWeight: "bold" },
});
