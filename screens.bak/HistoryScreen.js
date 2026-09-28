import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// useFocusEffect digunakan agar data me-refresh otomatis setiap kali kita pindah ke tab History
import { useFocusEffect } from "@react-navigation/native";

export default function HistoryScreen() {
  const [historyData, setHistoryData] = useState([]);

  // Fungsi untuk mengambil data dari memori
  const loadHistory = async () => {
    try {
      const storedData = await AsyncStorage.getItem("@freshia_history");
      if (storedData) {
        setHistoryData(JSON.parse(storedData));
      }
    } catch (e) {
      console.error("Gagal memuat riwayat", e);
    }
  };

  // Otomatis jalan saat tab History dibuka
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  // Fitur tambahan: Menghapus semua riwayat
  const clearHistory = async () => {
    Alert.alert(
      "Hapus Semua?",
      "Apakah Anda yakin ingin menghapus semua riwayat pindai?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("@freshia_history");
            setHistoryData([]); // Kosongkan tampilan
          },
        },
      ],
    );
  };

  // Komponen untuk menggambar tiap baris kartu di daftar
  const renderItem = ({ item }) => {
    // Memberi warna khusus berdasarkan hasil deteksi
    const isRotten = item.result.label.toLowerCase().includes("rotten");
    const statusColor = isRotten ? "#d32f2f" : "#388e3c"; // Merah jika busuk, hijau jika segar

    return (
      <View style={styles.card}>
        {/* Menampilkan foto yang tadi di-encode ke Base64 */}
        <Image source={{ uri: item.image }} style={styles.cardImage} />

        <View style={styles.cardContent}>
          <Text style={styles.dateText}>{item.date}</Text>
          <Text style={[styles.resultText, { color: statusColor }]}>
            Hasil: {item.result.label.toUpperCase()}
          </Text>
          <Text style={styles.confidenceText}>
            Akurasi: {item.result.confidence}%
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat Pindai</Text>
        {historyData.length > 0 && (
          <TouchableOpacity onPress={clearHistory}>
            <Text style={styles.clearBtnText}>Bersihkan</Text>
          </TouchableOpacity>
        )}
      </View>

      {historyData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Belum ada buah yang dipindai.</Text>
          <Text style={styles.emptySubText}>
            Gunakan tab Scan AI untuk mulai mendeteksi.
          </Text>
        </View>
      ) : (
        <FlatList
          data={historyData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#1b5e20" },
  clearBtnText: { color: "#d32f2f", fontWeight: "bold" },

  // Gaya tampilan Kartu Riwayat
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    elevation: 3, // Bayangan di Android
    shadowColor: "#000", // Bayangan di iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "hidden",
  },
  cardImage: { width: 100, height: 100, backgroundColor: "#ddd" },
  cardContent: { padding: 15, flex: 1, justifyContent: "center" },
  dateText: { fontSize: 12, color: "#757575", marginBottom: 5 },
  resultText: { fontSize: 16, fontWeight: "bold" },
  confidenceText: { fontSize: 14, color: "#555", marginTop: 3 },

  // Jika Riwayat Kosong
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 10,
  },
  emptySubText: { fontSize: 14, color: "#757575", textAlign: "center" },
});
