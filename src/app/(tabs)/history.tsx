import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { deleteDoc, doc } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

// Dialog konfirmasi lintas platform.
// Alert.alert dengan tombol tidak berfungsi di web, jadi web memakai window.confirm.
const confirmAction = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Batal", style: "cancel" },
    { text: confirmText, style: "destructive", onPress: onConfirm },
  ]);
};

// Hapus dokumen di Firestore. Entri lama tanpa firestoreId dilewati.
const deleteFromCloud = async (item: any) => {
  if (!item?.firestoreId) return;
  try {
    await deleteDoc(doc(db, "scan_history", item.firestoreId));
  } catch (e) {
    console.warn("Gagal hapus dokumen Firestore", e);
  }
};

// Baca riwayat TERBARU langsung dari AsyncStorage (bukan dari state layar).
// Penting karena firestoreId ditulis ke AsyncStorage oleh scanner.tsx
// beberapa detik setelah layar Riwayat memuat datanya.
const getFreshHistory = async (): Promise<any[]> => {
  const stored = await AsyncStorage.getItem("@freshia_history");
  return stored ? JSON.parse(stored) : [];
};

export default function HistoryScreen() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const router = useRouter();

  const loadHistory = async () => {
    try {
      const storedData = await AsyncStorage.getItem("@freshia_history");
      setHistoryData(storedData ? JSON.parse(storedData) : []);
    } catch (e) {
      console.error("Gagal memuat riwayat", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  // Toggle pengingat masa simpan
  const toggleReminder = async (id: string) => {
    try {
      const current = await getFreshHistory();
      const updatedHistory = current.map((item) =>
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

  // Hapus SATU item (lokal + Firestore)
  const deleteItem = (id: string) => {
    confirmAction(
      "Hapus Riwayat",
      "Apakah Anda yakin ingin menghapus data buah ini?",
      "Hapus",
      async () => {
        try {
          const current = await getFreshHistory();
          const target = current.find((item) => item.id === id);
          const updatedHistory = current.filter((item) => item.id !== id);
          setHistoryData(updatedHistory);
          await AsyncStorage.setItem(
            "@freshia_history",
            JSON.stringify(updatedHistory),
          );
          console.log(
            "Hapus, firestoreId:",
            target?.firestoreId ?? "(tidak ada)",
          );
          await deleteFromCloud(target);
        } catch (e) {
          console.error("Gagal menghapus riwayat spesifik", e);
        }
      },
    );
  };

  // Hapus SEMUA item (lokal + Firestore)
  const clearHistory = () => {
    confirmAction(
      "Hapus Semua?",
      "Apakah Anda yakin ingin menghapus SELURUH riwayat pindai?",
      "Hapus Semua",
      async () => {
        try {
          const snapshot = await getFreshHistory();
          await AsyncStorage.removeItem("@freshia_history");
          setHistoryData([]);

          await Promise.all(snapshot.map(deleteFromCloud));
        } catch (e) {
          console.error("Gagal menghapus semua riwayat", e);
        }
      },
    );
  };

  // Buka detail (navigasi ke Result)
  const openDetails = (item: any) => {
    router.push({
      pathname: "/result",
      params: {
        detection: item.result?.label ?? "Unknown",

        analysis: JSON.stringify(item.result?.analysis || {}),
      },
    });
  };

  const renderItem = ({ item }: { item: any }) => {
    const label: string = item.result?.label ?? "Unknown";
    const rawLabel = label.toLowerCase();
    const isRotten =
      rawLabel.includes("rotten") ||
      rawLabel.includes("busuk") ||
      rawLabel.includes("layu");
    const statusColor = isRotten ? "#d32f2f" : "#388e3c";

    const shelfLife = item.result?.analysis?.shelfLife || "Tidak ada data";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => openDetails(item)}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} />

        <View style={styles.cardContent}>
          <Text style={styles.dateText}>{item.date}</Text>
          <Text style={[styles.resultText, { color: statusColor }]}>
            {label.toUpperCase()}
          </Text>
          <Text style={styles.infoText}>
            Akurasi: {item.result?.confidence ?? "-"}%
          </Text>

          <Text style={styles.infoText}>Sisa Umur: {shelfLife}</Text>
        </View>

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
