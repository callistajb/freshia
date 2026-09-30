import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
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

export default function HistoryScreen() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const router = useRouter(); // Tambahkan router untuk navigasi

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

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  // Fungsi Toggle Pengingat Masa Simpan
  const toggleReminder = async (id: string) => {
    try {
      const updatedHistory = historyData.map((item) =>
        item.id === id ? { ...item, isTracked: !item.isTracked } : item,
      );
      setHistoryData(updatedHistory);
      await AsyncStorage.setItem(
        "@freshia_history",
        JSON.stringify(updatedHistory),
      );
    } catch (e) {
      console.error("Gagal menyimpan pengingat", e);
    }
  };

  // Fungsi Hapus SATU Item
  const deleteItem = (id: string) => {
    Alert.alert(
      "Hapus Riwayat",
      "Apakah Anda yakin ingin menghapus data buah ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              // Filter/buang item yang ID-nya sama dengan yang dihapus
              const updatedHistory = historyData.filter(
                (item) => item.id !== id,
              );
              setHistoryData(updatedHistory);
              await AsyncStorage.setItem(
                "@freshia_history",
                JSON.stringify(updatedHistory),
              );
            } catch (e) {
              console.error("Gagal menghapus riwayat spesifik", e);
            }
          },
        },
      ],
    );
  };

  // Fungsi Hapus SEMUA Item
  const clearHistory = async () => {
    Alert.alert(
      "Hapus Semua?",
      "Apakah Anda yakin ingin menghapus SELURUH riwayat pindai?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("@freshia_history");
            setHistoryData([]);
          },
        },
      ],
    );
  };

  // Fungsi Buka Detail (Navigasi ke Result)
  const openDetails = (item: any) => {
    router.push({
      pathname: "/result",
      params: {
        detection: item.result.label,
        // Kirim kembali data JSON analisisnya ke halaman Result
        analysis: JSON.stringify(item.result.analysis || {}),
      },
    });
  };

  const renderItem = ({ item }: { item: any }) => {
    const rawLabel = (item.result?.label || "unknown").toLowerCase();
    const isRotten =
      rawLabel.includes("rotten") ||
      rawLabel.includes("busuk") ||
      rawLabel.includes("layu");
    const statusColor = isRotten ? "#d32f2f" : "#388e3c";

    const shelfLife = item.result?.analysis?.shelfLife || "Tidak ada data";

    return (
      // Kartu utama sekarang bisa diklik untuk membuka detail
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => openDetails(item)}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} />

        <View style={styles.cardContent}>
          <Text style={styles.dateText}>{item.date}</Text>
          <Text style={[styles.resultText, { color: statusColor }]}>
            {item.result.label.toUpperCase()}
          </Text>
          <Text style={styles.infoText}>
            Akurasi: {item.result.confidence}%
          </Text>
          <Text style={styles.infoText}>Sisa Umur: {shelfLife}</Text>
        </View>

        {/* Kolom Aksi di sebelah kanan (Lonceng & Hapus) */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleReminder(item.id)}
          >
            <MaterialCommunityIcons
              name={item.isTracked ? "bell-ring" : "bell-outline"}
              size={24}
              color={item.isTracked ? "#fbc02d" : "#bdbdbd"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteItem(item.id)}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={24}
              color="#d32f2f"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat Pindai</Text>
        {historyData.length > 0 && (
          <TouchableOpacity onPress={clearHistory} style={styles.clearAllBtn}>
            <MaterialCommunityIcons
              name="delete-sweep-outline"
              size={20}
              color="#d32f2f"
            />
            <Text style={styles.clearBtnText}>Hapus Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {historyData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="history"
            size={60}
            color="#e0e0e0"
            style={{ marginBottom: 15 }}
          />
          <Text style={styles.emptyText}>Belum ada buah yang dipindai.</Text>
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
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffebee",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearBtnText: {
    color: "#d32f2f",
    fontWeight: "bold",
    marginLeft: 4,
    fontSize: 12,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "hidden",
  },
  cardImage: { width: 100, height: 100, backgroundColor: "#ddd" },
  cardContent: { padding: 12, flex: 1, justifyContent: "center" },
  dateText: { fontSize: 11, color: "#757575", marginBottom: 4 },
  resultText: { fontSize: 16, fontWeight: "bold" },
  infoText: { fontSize: 13, color: "#555", marginTop: 2 },

  actionContainer: {
    justifyContent: "space-between",
    borderLeftWidth: 1,
    borderLeftColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  actionButton: {
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  emptyText: { fontSize: 16, fontWeight: "bold", color: "#888" },
});
