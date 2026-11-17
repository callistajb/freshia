import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export interface FruitReminder {
  id: string;
  name: string;
  daysLeft: string;
  remainingDaysNum: number;
  storageTip: string;
  imageUri?: string;
  mode?: string;
  analysis?: any;
}

// Menghitung sisa hari secara dinamis dari tanggal scan hingga hari ini
const calculateDynamicShelfLife = (
  rawShelfLife: string,
  scanDateMs: number,
): { label: string; remainingDays: number } => {
  const match = String(rawShelfLife || "").match(/(\d+)/);
  if (!match) {
    return { label: rawShelfLife || "Segera konsumsi", remainingDays: 1 };
  }

  const initialDays = parseInt(match[1], 10);
  const now = new Date();
  const scanDate = new Date(scanDateMs);

  // Hitung selisih hari kalender (00:00)
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfScanDay = new Date(
    scanDate.getFullYear(),
    scanDate.getMonth(),
    scanDate.getDate(),
  ).getTime();

  const elapsedDays = Math.max(
    0,
    Math.floor((startOfToday - startOfScanDay) / (1000 * 60 * 60 * 24)),
  );
  const remaining = Math.max(0, initialDays - elapsedDays);

  if (remaining === 0) {
    return { label: "Hari ini terakhir", remainingDays: 0 };
  }
  return { label: `${remaining} hari lagi`, remainingDays: remaining };
};

// Tips penyimpanan otomatis sesuai jenis buah
const getStorageTipByFruit = (fruitName: string): string => {
  const lower = fruitName.toLowerCase();
  if (lower.includes("pisang") || lower.includes("banana")) {
    return "Jangan simpan di kulkas. Simpan di suhu ruangan";
  }
  if (lower.includes("melon") || lower.includes("semangka")) {
    return "Jangan simpan di kulkas utuh. Simpan di suhu ruangan";
  }
  if (lower.includes("blueberry") || lower.includes("anggur")) {
    return "Simpan di kulkas dalam wadah tertutup";
  }
  return "Simpan di kulkas agar lebih awet";
};

export default function ReminderScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<FruitReminder[]>([]);

  const loadReminders = useCallback(async () => {
    const currentUid = auth.currentUser?.uid;
    let items: FruitReminder[] = [];

    // 1. Baca dari cache lokal AsyncStorage (@freshia_history)
    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          items = parsed
            .filter((entry: any) => {
              if (currentUid && entry.userId && entry.userId !== currentUid) {
                return false;
              }
              const pct = Number(
                entry.result?.analysis?.freshnessPercentage ?? 0,
              );
              const label = String(entry.result?.label || "Buah").toLowerCase();
              const isNotFruit =
                pct === 0 && (label === "buah" || label === "unknown");
              return !isNotFruit;
            })
            .map((entry: any) => {
              const fruitName = String(entry.result?.label || "Buah");
              const rawShelf = String(
                entry.result?.analysis?.shelfLife || "3 hari",
              );
              const scanTimestamp = Number(entry.id) || Date.now();
              const { label, remainingDays } = calculateDynamicShelfLife(
                rawShelf,
                scanTimestamp,
              );

              return {
                id: String(entry.id),
                name: fruitName,
                daysLeft: label,
                remainingDaysNum: remainingDays,
                storageTip: getStorageTipByFruit(fruitName),
                imageUri: entry.image,
                mode: entry.mode,
                analysis: entry.result?.analysis,
              };
            });
        }
      }
    } catch (e) {
      console.warn("Gagal membaca reminder dari lokal:", e);
    }

    // 2. Sinkronisasi dengan Cloud Firestore jika lokal kosong
    if (items.length === 0) {
      try {
        const historyRef = collection(db, "scan_history");
        const q = currentUid
          ? query(
              historyRef,
              where("user_id", "==", currentUid),
              orderBy("timestamp", "desc"),
            )
          : query(historyRef, orderBy("timestamp", "desc"));

        const snapshot = await getDocs(q);
        items = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const pct = Number(data.analysis?.freshnessPercentage ?? 0);
            const fruitName = String(data.label || "Buah");
            const isNotFruit =
              pct === 0 &&
              (fruitName.toLowerCase() === "buah" ||
                fruitName.toLowerCase() === "unknown");
            if (isNotFruit) return null;

            const scanMs = data.timestamp?.toDate
              ? data.timestamp.toDate().getTime()
              : Date.now();
            const rawShelf = String(data.analysis?.shelfLife || "3 hari");
            const { label, remainingDays } = calculateDynamicShelfLife(
              rawShelf,
              scanMs,
            );

            return {
              id: docSnap.id,
              name: fruitName,
              daysLeft: label,
              remainingDaysNum: remainingDays,
              storageTip: getStorageTipByFruit(fruitName),
              imageUri: data.imageUrl,
              mode: data.mode,
              analysis: data.analysis,
            };
          })
          .filter(Boolean) as FruitReminder[];
      } catch (cloudErr) {
        console.warn("Sinkronisasi reminder Firestore dilewati:", cloudErr);
      }
    }

    // Urutkan dari sisa hari paling sedikit (paling mendesak) di atas
    items.sort((a, b) => a.remainingDaysNum - b.remainingDaysNum);
    setReminders(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReminders();
    }, [loadReminders]),
  );

  // Hitung jumlah buah yang kritis (<= 3 hari lagi)
  const urgentCount = reminders.filter((r) => r.remainingDaysNum <= 3).length;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header Merah */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.75}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Reminder Buah</Text>

        {/* Spacer agar judul tetap persis di tengah */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Konten Putih Melengkung */}
      <View style={styles.whiteBody}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner Ringkasan Buah Akan Segera Busuk */}
          <View style={styles.summaryBanner}>
            {/* Karakter Kiri */}
            <View style={styles.characterBadge}>
              <MaterialCommunityIcons
                name="food-apple"
                size={34}
                color="#C8201B"
              />
            </View>

            <View style={styles.summaryTextBox}>
              <Text style={styles.summaryTitle}>
                {urgentCount > 0 ? urgentCount : reminders.length} buah akan
                segera busuk
              </Text>
              <Text style={styles.summarySubtitle}>
                Segera konsumsi agar tidak terbuang!
              </Text>
            </View>

            {/* Karakter Kanan */}
            <View style={styles.characterBadge}>
              <MaterialCommunityIcons
                name="food-apple-outline"
                size={34}
                color="#9A1B17"
              />
            </View>
          </View>

          {/* Daftar Kartu Buah atau Empty State */}
          {reminders.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="notifications-off-outline"
                  size={34}
                  color="#9A1B17"
                />
              </View>
              <Text style={styles.emptyTitle}>Belum Ada Reminder Buah</Text>
              <Text style={styles.emptySubtitle}>
                Mulai pindai buah terlebih dahulu agar sistem dapat memantau
                kesegaran dan masa simpannya di sini.
              </Text>
              <TouchableOpacity
                style={styles.scanNowButton}
                activeOpacity={0.85}
                onPress={() => router.push("/(tabs)/scanner")}
              >
                <Text style={styles.scanNowButtonText}>
                  Pindai Buah Sekarang
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            reminders.map((item) => (
              <View key={item.id} style={styles.fruitCard}>
                {/* Foto Buah */}
                <View style={styles.fruitImageWrapper}>
                  {item.imageUri ? (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.fruitImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.fruitImageFallback}>
                      <MaterialCommunityIcons
                        name="fruit-cherries"
                        size={30}
                        color="#9A1B17"
                      />
                    </View>
                  )}
                </View>

                {/* Informasi Buah & Tombol Lihat Detail */}
                <View style={styles.fruitDetails}>
                  <View style={styles.fruitTopRow}>
                    <Text style={styles.fruitName}>{item.name}</Text>

                    <TouchableOpacity
                      style={styles.detailButton}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: "/result",
                          params: {
                            id: item.id,
                            detection: item.name,
                            mode: item.mode || "Pribadi",
                            imageUri: item.imageUri || "",
                            analysis: item.analysis
                              ? JSON.stringify(item.analysis)
                              : "",
                          },
                        })
                      }
                    >
                      <Text style={styles.detailButtonText}>
                        Lihat Detail ›
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Badge Waktu Sisa Hari */}
                  <View style={styles.timeBadge}>
                    <Ionicons name="time-outline" size={14} color="#C8201B" />
                    <Text style={styles.timeBadgeText}>{item.daysLeft}</Text>
                  </View>

                  {/* Tips Penyimpanan */}
                  <Text style={styles.storageTip} numberOfLines={2}>
                    {item.storageTip}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#C8201B",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#C8201B",
    paddingTop: Platform.OS === "ios" ? 56 : 42,
    paddingBottom: 24,
    paddingHorizontal: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSpacer: {
    width: 38,
  },

  /* Body Putih Melengkung */
  whiteBody: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 22,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Banner Pink Atas */
  summaryBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FCE8E8",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  characterBadge: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryTextBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  summaryTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#9A1B17",
    textAlign: "center",
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 11.5,
    color: "#333333",
    textAlign: "center",
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0E2E2",
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 22,
    alignItems: "center",
    marginTop: 6,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FCE8E8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9A1B17",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: "#666666",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  scanNowButton: {
    backgroundColor: "#C8201B",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  scanNowButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  /* Kartu Item Buah */
  fruitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2E2",
    borderRadius: 20,
    padding: 12,
    marginBottom: 14,
  },
  fruitImageWrapper: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FDECEC",
    marginRight: 12,
  },
  fruitImage: {
    width: 68,
    height: 68,
  },
  fruitImageFallback: {
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
  },
  fruitDetails: {
    flex: 1,
  },
  fruitTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  fruitName: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  detailButton: {
    backgroundColor: "#C8201B",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  detailButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FCE8E8",
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 12,
    gap: 4,
    marginBottom: 6,
  },
  timeBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#C8201B",
  },
  storageTip: {
    fontSize: 11.5,
    color: "#333333",
    lineHeight: 16,
  },
});
