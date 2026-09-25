import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    StyleSheet,
    Text,
    View,
} from "react-native";

// 1. IMPORT MODUL UNTUK MENGONTROL SISTEM HP
import * as SystemUI from "expo-system-ui";
import { Platform } from "react-native";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const takeAndAnalyzePhoto = async () => {
    if (!cameraRef.current) return;
    setIsProcessing(true);

    try {
      // 2. TRIK NINJA: Ubah warna latar belakang sistem sebentar untuk menipu rendering frame
      // (Pada beberapa kasus, ini membantu mem-bypass trigger suara bawaan)
      if (Platform.OS === "android") {
        await SystemUI.setBackgroundColorAsync("black");
      }

      // Ambil foto (Biarkan opsi shutterSound ada, meski HP-mu mengabaikannya)
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
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
        const confidenceScore = (topDetection.confidence * 100).toFixed(1);
        Alert.alert(
          "🍎 Deteksi Selesai!",
          `Status Buah: ${topDetection.class}\nAkurasi: ${confidenceScore}%`,
        );
      } else {
        Alert.alert("🤔 Hmm...", "Tidak menemukan buah.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Gagal", "Koneksi terputus.");
    } finally {
      setIsProcessing(false);
    }
  };

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
