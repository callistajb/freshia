import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const [stats, setStats] = useState({
    total: 0,
    fresh: 0,
    rotten: 0,
    unknown: 0,
  });
  const [trackedItems, setTrackedItems] = useState<any[]>([]);
  const router = useRouter();

  const loadDashboardData = async () => {
    try {
      const storedData = await AsyncStorage.getItem("@freshia_history");
      if (storedData) {
        const historyArray = JSON.parse(storedData);
        let freshCount = 0;
        let rottenCount = 0;
        let unknownCount = 0;

        // Logika statistik yang lebih akurat
        historyArray.forEach((item: any) => {
          const label = (item.result?.label || "").toLowerCase();

          if (
            label.includes("rotten") ||
            label.includes("busuk") ||
            label.includes("layu")
          ) {
            rottenCount++;
          } else if (
            label.includes("unknown") ||
            label.includes("gagal") ||
            label.includes("dilewati")
          ) {
            unknownCount++;
          } else {
            freshCount++; // Terhitung segar jika berhasil terdeteksi sebagai buah normal
          }
        });

        setStats({
          total: historyArray.length,
          fresh: freshCount,
          rotten: rottenCount,
          unknown: unknownCount,
        });

        // Ambil data yang dipasangi lonceng pengingat (isTracked === true)
        const reminders = historyArray.filter(
          (item: any) => item.isTracked === true,
        );
        setTrackedItems(reminders);
      }
    } catch (e) {
      console.error("Gagal memuat data dashboard", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, []),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Halo, Freshian! 👋</Text>
          <Text style={styles.subtitle}>Pantau kesegaran stok Anda</Text>
        </View>
        <MaterialCommunityIcons name="leaf-circle" size={40} color="#2e7d32" />
      </View>

      <Text style={styles.sectionTitle}>Ringkasan Pemindaian</Text>

      <View style={styles.statsContainer}>
        {/* Kartu Segar */}
        <View style={[styles.statCard, { backgroundColor: "#e8f5e9" }]}>
          <MaterialCommunityIcons
            name="check-decagram"
            size={28}
            color="#2e7d32"
          />
          <Text style={styles.statNumber}>{stats.fresh}</Text>
          <Text style={styles.statLabel}>Buah Segar</Text>
        </View>

        {/* Kartu Busuk */}
        <View style={[styles.statCard, { backgroundColor: "#ffebee" }]}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={28}
            color="#c62828"
          />
          <Text style={styles.statNumber}>{stats.rotten}</Text>
          <Text style={styles.statLabel}>Mulai Layu</Text>
        </View>

        {/* Kartu Unknown/Gagal */}
        <View style={[styles.statCard, { backgroundColor: "#f5f5f5" }]}>
          <MaterialCommunityIcons
            name="help-circle-outline"
            size={28}
            color="#757575"
          />
          <Text style={styles.statNumber}>{stats.unknown}</Text>
          <Text style={styles.statLabel}>Tak Dikenal</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Pengingat Masa Simpan</Text>
        <MaterialCommunityIcons name="bell-ring" size={20} color="#fbc02d" />
      </View>

      {trackedItems.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.reminderScroll}
        >
          {trackedItems.map((item) => (
            <View key={item.id} style={styles.reminderCard}>
              <Image
                source={{ uri: item.image }}
                style={styles.reminderImage}
              />
              <View style={styles.reminderOverlay}>
                <Text style={styles.reminderLabel} numberOfLines={1}>
                  {item.result.label}
                </Text>
                <View style={styles.shelfLifeBadge}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={12}
                    color="#fff"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.shelfLifeText}>
                    {item.result.analysis?.shelfLife || "N/A"}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons
            name="bell-sleep-outline"
            size={32}
            color="#bdbdbd"
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.emptyText}>Belum ada pengingat aktif.</Text>
          <Text style={styles.emptySubText}>
            Nyalakan ikon lonceng pada menu Riwayat untuk memantau masa simpan
            buah di sini.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push("/scanner")}
      >
        <MaterialCommunityIcons name="magnify-scan" size={24} color="#fff" />
        <Text style={styles.scanButtonText}>Mulai Pindai Buah Baru</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    marginTop: 10,
  },
  greeting: { fontSize: 24, fontWeight: "bold", color: "#1b5e20" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 15,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingRight: 5,
  },

  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  statCard: {
    width: "31%",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#333",
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#555",
    fontWeight: "600",
    textAlign: "center",
  },

  reminderScroll: { marginBottom: 30 },
  reminderCard: {
    width: 140,
    height: 160,
    marginRight: 15,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 3,
  },
  reminderImage: { width: "100%", height: "100%" },
  reminderOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
  },
  reminderLabel: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4,
  },
  shelfLifeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fbc02d",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  shelfLifeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },

  emptyCard: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  emptyText: { color: "#555", fontWeight: "bold", fontSize: 14 },
  emptySubText: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },

  scanButton: {
    backgroundColor: "#2e7d32",
    flexDirection: "row",
    padding: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
});
