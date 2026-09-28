import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SystemUI from "expo-system-ui";
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  StyleSheet,
  Text,
  View,
  Switch,
} from "react-native";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUmkmMode, setIsUmkmMode] = useState(false);
  const router = useRouter();

  const saveToHistory = async (photoUri, detectionResult) => {
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
      await AsyncStorage.setItem("@freshia_history", JSON.stringify(historyArray));
    } catch (e) {
      console.error("Gagal menyimpan ke history", e);
    }
  };

  const analyzeWithGemini = async (base64Image, roboflowLabel) => {
    const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API Key belum diatur di .env");
    }

    const mode = isUmkmMode ? "UMKM (stok jumlah besar)" : "Rumah Tangga (stok kecil)";
    
    const prompt = `Sistem visi awal mendeteksi gambar ini sebagai: ${roboflowLabel}. 
    Aplikasi saat ini berjalan pada mode: ${mode}.
    Tolong analisis buah ini dan kembalikan response MURNI dalam format JSON (tanpa markdown backticks) dengan struktur berikut:
    {
      "freshnessPercentage": angka (0-100),
      "salvageValue": "string estimasi rupiah",
      "shelfLife": "string prediksi hari",
      "recipe": "string saran resep zero-waste singkat"
    }`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    // Parse the JSON string from Gemini's response text
    const textResponse = data.candidates[0].content.parts[0].text;
    const cleanJsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonString);
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

      // 1. ROBOFLOW DETECTION
      const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
      const modelId = process.env.EXPO_PUBLIC_ROBOFLOW_MODEL_ID;
      const apiUrl = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}`;

      let rawClass = "Unknown";
      let confidenceScore = "0";

      if (apiKey && modelId) {
        const roboResponse = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: photo.base64,
        });
        const roboData = await roboResponse.json();
        
        if (roboData.predictions && roboData.predictions.length > 0) {
          rawClass = roboData.predictions[0].class;
          confidenceScore = (roboData.predictions[0].confidence * 100).toFixed(1);
        }
      } else {
        // Fallback jika belum pasang API Key Roboflow
        rawClass = "Buah (Deteksi awal dilewati)";
      }

      // 2. GEMINI ANALYSIS (Hybrid)
      let geminiAnalysis = null;
      try {
        geminiAnalysis = await analyzeWithGemini(photo.base64, rawClass);
      } catch (err) {
        console.warn("Gemini Error: ", err.message);
        // Fallback JSON jika error atau belum ada API Key
        geminiAnalysis = {
          freshnessPercentage: 0,
          salvageValue: "Rp0 (Error Gemini)",
          shelfLife: "0 hari",
          recipe: "Pastikan EXPO_PUBLIC_GEMINI_API_KEY sudah diisi."
        };
      }

      // Simpan ke history
      await saveToHistory(photo.uri, {
        label: rawClass,
        confidence: confidenceScore,
      });

      // Navigasi ke halaman hasil
      router.push({
        pathname: "/result",
        params: {
          detection: rawClass,
          analysis: JSON.stringify(geminiAnalysis)
        }
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
        <Button onPress={requestPermission} title="Berikan Izin" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.modeText}>Mode: {isUmkmMode ? "UMKM" : "Rumah Tangga"}</Text>
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
            <Text style={styles.loadingText}>Menganalisis dengan Hybrid AI...</Text>
          </View>
        ) : (
          <Button title="✨ Pindai AI" color="#2e7d32" onPress={takeAndAnalyzePhoto} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  containerCentered: { flex: 1, justifyContent: "center", alignItems: "center" },
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
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: { width: 250, height: 250, borderWidth: 2, borderColor: "#00E676" },
  buttonContainer: { position: "absolute", bottom: 40, alignSelf: "center" },
  loadingWrapper: { alignItems: "center" },
  loadingText: { color: "#00E676", marginTop: 10, fontWeight: "bold" }
});
