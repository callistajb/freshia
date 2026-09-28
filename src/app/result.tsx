import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View, ScrollView, Button } from "react-native";

export default function ResultScreen() {
  const router = useRouter();
  const { detection, analysis } = useLocalSearchParams();
  
  // Parse JSON string
  const analysisData = analysis ? JSON.parse(analysis as string) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Hasil Analisis AI</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Deteksi Awal (Roboflow):</Text>
        <Text style={styles.value}>{detection || "Tidak tersedia"}</Text>
      </View>

      {analysisData ? (
        <View style={styles.card}>
          <Text style={styles.label}>Tingkat Kesegaran:</Text>
          <Text style={styles.value}>{analysisData.freshnessPercentage}%</Text>
          
          <Text style={styles.label}>Estimasi Nilai Sisa (Salvage Value):</Text>
          <Text style={styles.value}>{analysisData.salvageValue}</Text>
          
          <Text style={styles.label}>Prediksi Masa Simpan:</Text>
          <Text style={styles.value}>{analysisData.shelfLife}</Text>
          
          <Text style={styles.label}>Saran Resep Zero-Waste:</Text>
          <Text style={styles.value}>{analysisData.recipe}</Text>
        </View>
      ) : (
        <Text style={styles.loadingText}>Menunggu analisis Gemini...</Text>
      )}

      <Button title="Kembali ke Scanner" onPress={() => router.back()} color="#2e7d32" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1b5e20", marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
  },
  label: { fontSize: 14, color: "#666", marginTop: 10 },
  value: { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 4 },
  loadingText: { textAlign: "center", marginVertical: 20, fontStyle: "italic" }
});
