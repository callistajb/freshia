import AsyncStorage from "@react-native-async-storage/async-storage"; // IMPORT BARU
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SystemUI from "expo-system-ui";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- FUNGSI BARU: SIMPAN KE HISTORY ---
  // Ubah parameter pertama menjadi photoUri
  const saveToHistory = async (photoUri, detectionResult) => {
    try {
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        // SIMPAN JALUR FILE-NYA, BUKAN TEKS BASE64-NYA
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

      console.log("Berhasil disimpan ke History!");
    } catch (e) {
      console.error("Gagal menyimpan ke history", e);
    }
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
        quality: 0.3, // Kita turunkan sedikit agar tidak menghabiskan memori HP
        shutterSound: false,
      });

      const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
      const modelId = process.env.EXPO_PUBLIC_ROBOFLOW_MODEL_ID;
      const apiUrl = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: photo.base64,
      });

      const data = await response.json();

      if (data.predictions && data.predictions.length > 0) {
        const topDetection = data.predictions[0];

        // Memisahkan label buah.
        // Contoh: Jika AI membalas "rotten_apple", kita percantik.
        const rawClass = topDetection.class;
        const confidenceScore = (topDetection.confidence * 100).toFixed(1);

        // Eksekusi fungsi penyimpanan!
        await saveToHistory(photo.base64, {
          label: rawClass,
          confidence: confidenceScore,
        });

        Alert.alert(
          "🍎 Deteksi Selesai!",
          `Status: ${rawClass}\nAkurasi: ${confidenceScore}%\n\nData dan foto telah disimpan ke History!`,
        );
      } else {
        Alert.alert(
          "🤔 Hmm...",
          "Tidak menemukan buah. Coba arahkan dengan lebih jelas.",
        );
      }
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
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
      </View>
      <View style={styles.buttonContainer}>
        {isProcessing ? (
          <ActivityIndicator size="large" color="#00E676" />
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
});
