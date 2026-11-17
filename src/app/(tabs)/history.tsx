import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

export interface ScanHistoryItem {
  id: string;
  firestoreId?: string;
  fruitName: string; // Contoh: "Pisang" -> tampil sebagai "Scanned Pisang"
  dateTime: string; // Contoh: "23 September 2026 • 13.00 WIB"
  mode: "Mode Bisnis" | "Mode Pribadi";
  freshnessPercent: number; // Contoh: 90 atau 15
  status: "diproses" | "butuh_perhatian";
  imageUri?: string;
  analysis?: {
    freshnessPercentage: number;
    salvageValue: string;
    shelfLife: string;
    recipe: string;
  };
}

type FilterTab = "terbaru" | "diproses" | "butuh_perhatian";

export default function HistoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [imgError, setImgError] = useState(false);

  const [historyList, setHistoryList] = useState<ScanHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("terbaru");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setImgError(false);
    });
    return unsubscribe;
  }, []);

  // Memuat riwayat dari AsyncStorage (Offline-First) lalu menyinkronkan dengan Firestore
  const loadHistoryData = useCallback(async () => {
    const currentUid = auth.currentUser?.uid;

    // 1. Baca dari cache lokal AsyncStorage dulu agar tampil instan
    let localItems: ScanHistoryItem[] = [];
    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localItems = parsed
            .filter(
              (entry: any) =>
                !currentUid || !entry.userId || entry.userId === currentUid,
            )
            .map((entry: any) => {
              const pct = Number(
                entry.result?.analysis?.freshnessPercentage ?? 0,
              );
              const rawMode = String(entry.mode || "Pribadi");
              return {
                id: String(entry.id),
                firestoreId: entry.firestoreId,
                fruitName: String(entry.result?.label || "Buah"),
                dateTime: String(entry.date || "-"),
                mode:
                  rawMode === "Bisnis" || rawMode === "Mode Bisnis"
                    ? "Mode Bisnis"
                    : "Mode Pribadi",
                freshnessPercent: pct,
                status: pct >= 50 ? "diproses" : "butuh_perhatian",
                imageUri: entry.image,
                analysis: entry.result?.analysis,
              };
            });
          setHistoryList(localItems);
        }
      }
    } catch (e) {
      console.warn("Gagal membaca riwayat lokal:", e);
    }

    // 2. Sinkronisasi dengan Cloud Firestore (collection: scan_history) tanpa composite index
    try {
      const historyRef = collection(db, "scan_history");
      const q = currentUid
        ? query(historyRef, where("user_id", "==", currentUid))
        : query(historyRef);

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
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

        const cloudItems: ScanHistoryItem[] = sortedDocs.map((docSnap) => {
          const data = docSnap.data();
          const pct = Number(data.analysis?.freshnessPercentage ?? 0);
          const rawMode = String(data.mode || "Pribadi");

          let formattedDate = "-";
          if (data.timestamp?.toDate) {
            formattedDate = data.timestamp.toDate().toLocaleString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          } else if (data.timestamp) {
            formattedDate = new Date(data.timestamp).toLocaleString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }

          return {
            id: docSnap.id,
            firestoreId: docSnap.id,
            fruitName: String(data.label || "Buah"),
            dateTime: formattedDate,
            mode:
              rawMode === "Bisnis" || rawMode === "Mode Bisnis"
                ? "Mode Bisnis"
                : "Mode Pribadi",
            freshnessPercent: pct,
            status: pct >= 50 ? "diproses" : "butuh_perhatian",
            imageUri: data.imageUrl,
            analysis: data.analysis,
          };
        });

        // Gabungkan data cloud dengan lokal yang mungkin belum ter-upload
        const cloudIds = new Set(cloudItems.map((c) => c.firestoreId));
        const unsyncedLocals = localItems.filter(
          (l) => !l.firestoreId || !cloudIds.has(l.firestoreId),
        );
        setHistoryList([...unsyncedLocals, ...cloudItems]);
      }
    } catch (cloudErr) {
      // Jika offline, tetap gunakan data lokal
      console.warn("Sinkronisasi Firestore dilewati:", cloudErr);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistoryData();
    }, [loadHistoryData]),
  );

  // Hapus satu item riwayat dari state, AsyncStorage, dan Firestore
  const performDeleteSingle = async (item: ScanHistoryItem) => {
    setHistoryList((prev) => prev.filter((entry) => entry.id !== item.id));

    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter(
            (entry: any) =>
              String(entry.id) !== item.id &&
              String(entry.firestoreId || "") !== (item.firestoreId || item.id),
          );
          await AsyncStorage.setItem(
            "@freshia_history",
            JSON.stringify(updated),
          );
        }
      }
    } catch (e) {
      console.warn("Gagal menghapus item lokal:", e);
    }

    const docIdToDelete = item.firestoreId || item.id;
    if (docIdToDelete) {
      try {
        await deleteDoc(doc(db, "scan_history", docIdToDelete));
      } catch (err) {
        console.warn("Penghapusan dokumen Firestore dilewati:", err);
      }
    }
  };

  const handleDeleteItem = (item: ScanHistoryItem) => {
    const title = "Hapus Riwayat";
    const message = `Hapus riwayat "Scanned ${item.fruitName}"?`;

    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        performDeleteSingle(item);
      }
    } else {
      Alert.alert(title, message, [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => performDeleteSingle(item),
        },
      ]);
    }
  };

  // Hapus seluruh riwayat milik pengguna saat ini
  const performClearAll = async () => {
    const currentUid = auth.currentUser?.uid;
    const itemsToDelete = [...historyList];
    setHistoryList([]);

    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const remaining = currentUid
            ? parsed.filter(
                (entry: any) => entry.userId && entry.userId !== currentUid,
              )
            : [];
          await AsyncStorage.setItem(
            "@freshia_history",
            JSON.stringify(remaining),
          );
        }
      }
    } catch (e) {
      console.warn("Gagal mengosongkan riwayat lokal:", e);
    }

    try {
      const deletePromises = itemsToDelete
        .map((item) => item.firestoreId || item.id)
        .filter(Boolean)
        .map((docId) => deleteDoc(doc(db, "scan_history", docId)));
      await Promise.allSettled(deletePromises);
    } catch (err) {
      console.warn("Penghapusan massal Firestore dilewati:", err);
    }
  };

  const handleClearAll = () => {
    const title = "Hapus Semua Riwayat";
    const message =
      "Semua riwayat pemindaian buah akan dihapus permanen. Lanjutkan?";

    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        performClearAll();
      }
    } else {
      Alert.alert(title, message, [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: performClearAll,
        },
      ]);
    }
  };

  const displayName =
    user?.displayName || (user?.email ? user.email.split("@")[0] : "Freshian");

  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      const keyword = searchQuery.trim().toLowerCase();
      const matchesSearch =
        keyword === "" ||
        item.fruitName.toLowerCase().includes(keyword) ||
        `scanned ${item.fruitName}`.toLowerCase().includes(keyword) ||
        item.mode.toLowerCase().includes(keyword) ||
        item.dateTime.toLowerCase().includes(keyword);

      if (!matchesSearch) return false;

      if (activeFilter === "diproses") {
        return item.status === "diproses" || item.freshnessPercent >= 50;
      }
      if (activeFilter === "butuh_perhatian") {
        return item.status === "butuh_perhatian" || item.freshnessPercent < 50;
      }
      return true;
    });
  }, [historyList, searchQuery, activeFilter]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
              {user?.photoURL && !imgError ? (
                Platform.OS === "web" ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.profileAvatar}
                    onError={() => setImgError(true)}
                  />
                )
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

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Daftar Hasil Scan</Text>
              <Text style={styles.sectionSubtitle}>
                Riwayat buah yang pernah kamu scan
              </Text>
            </View>

            {historyList.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllButton}
                activeOpacity={0.75}
                onPress={handleClearAll}
              >
                <Ionicons name="trash-outline" size={14} color="#C8201B" />
                <Text style={styles.clearAllText}>Hapus Semua</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Bar: Cari Riwayat */}
          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#9E9E9E"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari Riwayat"
              placeholderTextColor="#9E9E9E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={18} color="#9E9E9E" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills: Terbaru | Diproses | Butuh Perhatian */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === "terbaru" && styles.filterPillActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setActiveFilter("terbaru")}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === "terbaru" && styles.filterPillTextActive,
                ]}
              >
                Terbaru
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === "diproses" && styles.filterPillActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setActiveFilter("diproses")}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === "diproses" && styles.filterPillTextActive,
                ]}
              >
                Diproses
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === "butuh_perhatian" && styles.filterPillActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setActiveFilter("butuh_perhatian")}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === "butuh_perhatian" &&
                    styles.filterPillTextActive,
                ]}
              >
                Butuh Perhatian
              </Text>
            </TouchableOpacity>
          </View>

          {/* Daftar Riwayat atau Empty State */}
          {filteredHistory.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={34}
                  color="#9A1B17"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {historyList.length === 0
                  ? "Belum Ada Riwayat Scan"
                  : "Riwayat Tidak Ditemukan"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {historyList.length === 0
                  ? "Hasil pemindaian buahmu akan otomatis tersimpan dan muncul di halaman ini."
                  : "Coba ubah kata kunci pencarian atau pilih kategori filter lainnya."}
              </Text>
              {historyList.length === 0 && (
                <TouchableOpacity
                  style={styles.scanNowButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/(tabs)/scanner")}
                >
                  <Text style={styles.scanNowButtonText}>Mulai Scan Buah</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredHistory.map((item) => {
              const isFresh = item.freshnessPercent >= 50;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/result",
                      params: {
                        id: item.id,
                        detection: item.fruitName,
                        mode:
                          item.mode === "Mode Bisnis" ? "Bisnis" : "Pribadi",
                        imageUri: item.imageUri || "",
                        analysis: item.analysis
                          ? JSON.stringify(item.analysis)
                          : "",
                      },
                    })
                  }
                >
                  {/* Foto Hasil Scan */}
                  <View style={styles.thumbnailWrapper}>
                    {item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.thumbnailFallback}>
                        <MaterialCommunityIcons
                          name="food-apple"
                          size={30}
                          color="#9A1B17"
                        />
                      </View>
                    )}
                  </View>

                  {/* Detail Tengah & Badge Persentase + Tombol Hapus Kanan */}
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.scannedTitle} numberOfLines={1}>
                        Scanned {item.fruitName}
                      </Text>

                      <View
                        style={[
                          styles.freshBadge,
                          isFresh
                            ? styles.freshBadgeGood
                            : styles.freshBadgeWarn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.freshBadgeText,
                            isFresh
                              ? styles.freshBadgeTextGood
                              : styles.freshBadgeTextWarn,
                          ]}
                        >
                          Fresh {item.freshnessPercent}%
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.dateTimeText}>{item.dateTime}</Text>

                    <View style={styles.cardBottomRow}>
                      <Text style={styles.modeText}>{item.mode}</Text>

                      <TouchableOpacity
                        style={styles.deleteItemButton}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDeleteItem(item);
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#C8201B"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8E1612",
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9A1B17",
  },
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FCE8E8",
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
  },
  clearAllText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#C8201B",
  },

  /* Search Bar */
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#9A1B17",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#1C1C1E",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  /* Filter Pills */
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterPill: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2DADA",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  filterPillActive: {
    backgroundColor: "#FCE8E8",
    borderColor: "#9A1B17",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  filterPillTextActive: {
    color: "#9A1B17",
    fontWeight: "600",
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0E2E2",
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 22,
    alignItems: "center",
    marginTop: 4,
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

  /* Kartu Item Riwayat Scan */
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  thumbnailWrapper: {
    width: 68,
    height: 68,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#FDECEC",
    marginRight: 12,
  },
  thumbnailImage: {
    width: 68,
    height: 68,
  },
  thumbnailFallback: {
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 5,
  },
  scannedTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  freshBadge: {
    paddingVertical: 3,
    paddingHorizontal: 11,
    borderRadius: 12,
  },
  freshBadgeGood: {
    backgroundColor: "#D8F5DC",
  },
  freshBadgeWarn: {
    backgroundColor: "#FCE0E0",
  },
  freshBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  freshBadgeTextGood: {
    color: "#32A852",
  },
  freshBadgeTextWarn: {
    color: "#E03A3E",
  },
  dateTimeText: {
    fontSize: 11.5,
    color: "#333333",
    marginBottom: 5,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  deleteItemButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#FFF2F2",
  },
});
