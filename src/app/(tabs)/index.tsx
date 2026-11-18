import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import { resolveUserAvatar } from "../../utils/avatarSync";

export interface ReminderItem {
  id: string;
  name: string;
  daysLeft: string;
  remainingDaysNum: number;
  imageUri?: string;
  mode?: string;
  analysis?: any;
}

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

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isReminderEnabled, setIsReminderEnabled] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { resolveUserAvatar(currentUser).then(setCustomPhoto).catch(() => {});
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const loadHomeReminders = useCallback(async () => {
    resolveUserAvatar(auth.currentUser).then((av) => { setCustomPhoto(av); setImgError(false); }).catch(() => {});
    // 0. Cek preferensi Reminder Buah Hampir Busuk dari halaman Profile
    let enabled = true;
    try {
      const directFlag = await AsyncStorage.getItem(
        "@freshia_reminder_enabled",
      );
      if (directFlag !== null) {
        enabled = directFlag === "true";
      } else {
        const prefRaw = await AsyncStorage.getItem("@freshia_preferences");
        if (prefRaw) {
          const parsedPref = JSON.parse(prefRaw);
          if (typeof parsedPref.reminderEnabled === "boolean") {
            enabled = parsedPref.reminderEnabled;
          } else if (typeof parsedPref.isReminderEnabled === "boolean") {
            enabled = parsedPref.isReminderEnabled;
          }
        }
      }
    } catch (prefErr) {
      console.warn("Gagal membaca preferensi reminder:", prefErr);
    }

    setIsReminderEnabled(enabled);
    if (!enabled) {
      setReminders([]);
      return;
    }

    const currentUid = auth.currentUser?.uid;
    let items: ReminderItem[] = [];

    // 1. Baca dari AsyncStorage (@freshia_history) terlebih dahulu
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
                imageUri: entry.image,
                mode: entry.mode,
                analysis: entry.result?.analysis,
              };
            });
        }
      }
    } catch (e) {
      console.warn("Gagal membaca reminder lokal di Home:", e);
    }

    // 2. Sinkronisasi dengan Cloud Firestore jika data lokal masih kosong (tanpa composite index)
    if (items.length === 0) {
      try {
        const historyRef = collection(db, "scan_history");
        const q = currentUid
          ? query(historyRef, where("user_id", "==", currentUid))
          : query(historyRef);

        const snapshot = await getDocs(q);
        const sortedDocs = [...snapshot.docs].sort((a, b) => {
          const tsA = a.data().timestamp?.toMillis
            ? a.data().timestamp.toMillis()
            : a.data().timestamp
              ? new Date(a.data().timestamp).getTime()
              : 0;
          const tsB = b.data().timestamp?.toMillis
            ? b.data().timestamp.toMillis()
            : b.data().timestamp
              ? new Date(b.data().timestamp).getTime()
              : 0;
          return tsB - tsA;
        });

        items = sortedDocs
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
              imageUri: data.imageUrl,
              mode: data.mode,
              analysis: data.analysis,
            };
          })
          .filter(Boolean) as ReminderItem[];
      } catch (cloudErr) {
        console.warn(
          "Sinkronisasi reminder Home Firestore dilewati:",
          cloudErr,
        );
      }
    }

    items.sort((a, b) => a.remainingDaysNum - b.remainingDaysNum);
    setReminders(items.slice(0, 3));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHomeReminders();
    }, [loadHomeReminders]),
  );

  const displayName =
    user?.displayName || (user?.email ? user.email.split("@")[0] : "Freshian");
  const activeAvatarUri = customPhoto || user?.photoURL || null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Merah */}
        <View style={styles.headerSection}>
          {/* Top Bar: Logo Freshia & Foto Profil Kanan Atas */}
          <View style={styles.topBar}>
            <Image
              source={require("../../../assets/images/freshia-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.8}
              style={styles.profileAvatarButton}
            >
              {activeAvatarUri && !imgError ? (
                <Image
                  source={{ uri: activeAvatarUri }} onError={() => setImgError(true)}
                  style={styles.profileAvatar}
                />
              ) : (
                <View style={styles.profileAvatarFallback}>
                  <Ionicons name="person" size={22} color="#9A1B17" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Sapaan Pengguna */}
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingTitle}>Hi, {displayName}!</Text>
            <Text style={styles.greetingSubtitle}>
              Yuk jaga buah-buahanmu tetap segar{"\n"}dan nikmati setiap
              gigitannya!
            </Text>
          </View>
        </View>

        {/* Konten Putih Melengkung */}
        <View style={styles.whiteBody}>
          {/* Maskot Buah Freshia bertengger di kanan batas merah-putih */}
          <Image
            source={require("../../../assets/images/buah freshia.png")}
            style={styles.buahFreshiaMascot}
            resizeMode="contain"
          />

          <Text style={styles.welcomeHeading}>Welcome to Freshia</Text>

          {/* Banner 1: Peringatan Tanggal Busuk (hanya tampil jika Reminder aktif) */}
          {isReminderEnabled && (
            <TouchableOpacity
              style={styles.alertBanner}
              activeOpacity={0.85}
              onPress={() => router.push("/reminder")}
            >
              <View style={styles.alertBellCircle}>
                <Ionicons name="notifications" size={24} color="#9A1B17" />
              </View>
              <View style={styles.alertTextBox}>
                <Text style={styles.alertTitle}>
                  Ada Buah yang{"\n"}mendekati tanggal busuk !
                </Text>
                <Text style={styles.alertSubtitle}>
                  Cek sekarang agar tidak terbuang
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#1C1C1E" />
            </TouchableOpacity>
          )}

          {/* Kartu 2: Reminder Buah */}
          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <View>
                <Text style={styles.reminderTitle}>Reminder Buah</Text>
                <Text style={styles.reminderSubtitle}>
                  {isReminderEnabled
                    ? "Buah yang hampir busuk"
                    : "Notifikasi reminder dinonaktifkan"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.smallBellCircle}
                activeOpacity={0.8}
                onPress={() => router.push("/reminder")}
              >
                <Ionicons
                  name={
                    isReminderEnabled
                      ? "notifications"
                      : "notifications-off-outline"
                  }
                  size={18}
                  color="#9A1B17"
                />
              </TouchableOpacity>
            </View>

            {/* Kotak Putih Kosong jika reminder nonaktif atau belum ada buah hampir busuk */}
            {!isReminderEnabled ? (
              <TouchableOpacity
                style={styles.emptyReminderBox}
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/profile")}
              >
                <Text style={styles.emptyReminderText}>
                  Reminder dimatikan. Ketuk untuk mengaktifkan di Profil
                </Text>
              </TouchableOpacity>
            ) : reminders.length === 0 ? (
              <View style={styles.emptyReminderBox}>
                <Text style={styles.emptyReminderText}>
                  Belum ada buah yang mendekati tanggal busuk
                </Text>
              </View>
            ) : (
              reminders.map((item) => (
                <View key={item.id} style={styles.fruitItemRow}>
                  <View style={styles.fruitInfo}>
                    <Text style={styles.fruitName}>{item.name}</Text>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={14} color="#C8201B" />
                      <Text style={styles.timeText}>{item.daysLeft}</Text>
                    </View>
                  </View>

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
                    <Text style={styles.detailButtonText}>Lihat Detail ›</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Kartu 3: Promo Resep ("Jangan biarkan buahmu terbuang!") */}
          <View style={styles.recipePromoCard}>
            {/* Hiasan Daun Pojok Kanan Atas */}
            <Image
              source={require("../../../assets/images/daun.png")}
              style={styles.leafTopRight}
              resizeMode="contain"
            />

            {/* Hiasan Daun Pojok Kiri Bawah */}
            <Image
              source={require("../../../assets/images/daun.png")}
              style={styles.leafBottomLeft}
              resizeMode="contain"
            />

            <View style={styles.recipeLeftContent}>
              <Text style={styles.recipeQuoteTitle}>
                “Jangan biarkan{"\n"}buahmu terbuang!”
              </Text>
              <Text style={styles.recipeDesc}>
                Temukan resep mudah dan sehat dari buah yang kamu punya.
              </Text>
              <TouchableOpacity
                style={styles.recipeButton}
                activeOpacity={0.85}
                onPress={() => router.push("/(tabs)/resep")}
              >
                <Text style={styles.recipeButtonText}>Lihat Resep ›</Text>
              </TouchableOpacity>
            </View>

            {/* Ilustrasi Apel Makan */}
            <Image
              source={require("../../../assets/images/apel makan.png")}
              style={styles.apelMakanImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFBFB",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#FFFBFB",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#FFFBFB",
    paddingBottom: 110,
  },
  headerSection: {
    backgroundColor: "#C8201B",
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    paddingHorizontal: 22,
    paddingBottom: 62,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  logo: {
    width: 115,
    height: 40,
  },
  profileAvatarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatar: {
    width: 42,
    height: 42,
  },
  profileAvatarFallback: {
    width: 42,
    height: 42,
    backgroundColor: "#FDECEC",
    justifyContent: "center",
    alignItems: "center",
  },
  greetingContainer: {
    paddingRight: 20,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  greetingSubtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#FDECEC",
  },

  /* Body Putih Melengkung */
  whiteBody: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -24,
    paddingTop: 22,
    paddingHorizontal: 20,
    position: "relative",
  },
  buahFreshiaMascot: {
    position: "absolute",
    top: -62,
    right: 14,
    width: 175,
    height: 92,
    zIndex: 10,
  },
  welcomeHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8E1612",
    marginBottom: 14,
  },

  /* Banner 1: Alert */
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  alertBellCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F8CACA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  alertTextBox: {
    flex: 1,
    paddingRight: 6,
  },
  alertTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#9A1B17",
    lineHeight: 18,
    marginBottom: 3,
  },
  alertSubtitle: {
    fontSize: 11.5,
    color: "#333333",
  },

  /* Kartu 2: Reminder Buah */
  reminderCard: {
    backgroundColor: "#FCE8E8",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  reminderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#9A1B17",
    marginBottom: 2,
  },
  reminderSubtitle: {
    fontSize: 12,
    color: "#9A1B17",
  },
  smallBellCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8CACA",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyReminderBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyReminderText: {
    fontSize: 12,
    color: "#9E9E9E",
    textAlign: "center",
  },
  fruitItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  fruitInfo: {
    flex: 1,
  },
  fruitName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C8201B",
  },
  detailButton: {
    backgroundColor: "#C8201B",
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 16,
  },
  detailButtonText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
  },

  /* Kartu 3: Jangan biarkan buahmu terbuang */
  recipePromoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    borderRadius: 20,
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: 8,
    overflow: "hidden",
    position: "relative",
    minHeight: 175,
  },
  leafTopRight: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 44,
    height: 36,
    transform: [{ rotate: "15deg" }],
  },
  leafBottomLeft: {
    position: "absolute",
    bottom: -6,
    left: -6,
    width: 46,
    height: 38,
    transform: [{ rotate: "-25deg" }],
  },
  recipeLeftContent: {
    flex: 1.15,
    zIndex: 2,
  },
  recipeQuoteTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9A1B17",
    lineHeight: 20,
    marginBottom: 8,
  },
  recipeDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#9A1B17",
    marginBottom: 14,
  },
  recipeButton: {
    alignSelf: "flex-start",
    backgroundColor: "#C8201B",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  recipeButtonText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
  },
  apelMakanImage: {
    width: 145,
    height: 145,
    zIndex: 2,
  },
});
