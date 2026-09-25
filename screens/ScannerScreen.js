import { Button, StyleSheet, Text, View } from "react-native";

export default function ScannerScreen() {
  // --- KODE LOGIKA AI DARI ROBOFLOW ---
  const analyzeFruitWithRoboflow = async (base64Image) => {
    const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
    const modelId = process.env.EXPO_PUBLIC_ROBOFLOW_MODEL_ID;

    const apiUrl = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: base64Image,
      });

      const data = await response.json();
      console.log("Total buah terdeteksi:", data.predictions.length);
      console.log("Detail deteksi pertama:", data.predictions[0]);
    } catch (error) {
      console.error("Gagal mendeteksi gambar:", error);
    }
  };

  // --- FUNGSI PEMICU SEMENTARA ---
  const handleTestScan = () => {
    console.log(
      "Tombol ditekan! Nanti gambar dari kamera akan dikirim ke fungsi analyzeFruitWithRoboflow...",
    );
    // analyzeFruitWithRoboflow("dataBase64GambarNantiDisini");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kamera AI Scanner</Text>

      {/* Tombol sementara untuk mengecek apakah UI tidak error */}
      <View style={{ marginTop: 20 }}>
        <Button
          title="Simulasikan Scan AI"
          onPress={handleTestScan}
          color="#2e7d32"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1b5e20" },
});
