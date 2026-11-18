import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { deleteUser, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import { resolveUserAvatar } from "../../utils/avatarSync";
import { submitFeedback, ensureCollectionsInitialized } from "../../services/firestoreService";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Statistik nyata pengguna
  const [totalScans, setTotalScans] = useState(0);
  const [savedFruits, setSavedFruits] = useState(0);
  const [savedValueLabel, setSavedValueLabel] = useState("Rp 0");

  // Preferensi aplikasi
  const [defaultMode, setDefaultMode] = useState<"Pribadi" | "Bisnis">(
    "Pribadi",
  );
  const [reminderEnabled, setReminderEnabled] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setImgError(false);
    });
    return unsubscribe;
  }, []);

  const loadProfileData = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload().catch(() => {});
      setUser(auth.currentUser);
    }

    const currentUid = auth.currentUser?.uid;
    const resolvedAv = await resolveUserAvatar(auth.currentUser); if (resolvedAv) { setCustomPhoto(resolvedAv); setImgError(false); }
    if (currentUid) { ensureCollectionsInitialized(currentUid).catch(() => {}); }

    // Muat foto profil kustom (Base64 dari cache lokal / Firestore)
    if (currentUid) {
      try {
        const cachedAvatar = await AsyncStorage.getItem(
          `@freshia_avatar_${currentUid}`,
        );
        if (cachedAvatar) {
          setCustomPhoto(cachedAvatar);
          setImgError(false);
        }

        const userSnap = await getDoc(doc(db, "users", currentUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.photoBase64) {
            const base64Str = String(userData.photoBase64);
            setCustomPhoto(base64Str);
            setImgError(false);
            await AsyncStorage.setItem(
              `@freshia_avatar_${currentUid}`,
              base64Str,
            );
          }
        }
      } catch {}
    }

    // Muat preferensi tersimpan
    try {
      const savedMode = await AsyncStorage.getItem("@freshia_default_mode");
      if (savedMode === "Bisnis" || savedMode === "Pribadi") {
        setDefaultMode(savedMode);
      }
      const savedReminder = await AsyncStorage.getItem(
        "@freshia_reminder_enabled",
      );
      if (savedReminder !== null) {
        setReminderEnabled(savedReminder === "true");
      }
    } catch {}

    // Hitung statistik dampak dari riwayat scan user
    let entries: { pct: number; salvage: string }[] = [];

    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          entries = parsed
            .filter(
              (item: any) =>
                !currentUid || !item.userId || item.userId === currentUid,
            )
            .map((item: any) => ({
              pct: Number(item.result?.analysis?.freshnessPercentage ?? 0),
              salvage: String(item.result?.analysis?.salvageValue || ""),
            }));
        }
      }
    } catch {}

    if (entries.length === 0 && currentUid) {
      try {
        const q = query(
          collection(db, "scan_history"),
          where("user_id", "==", currentUid),
        );
        const snap = await getDocs(q);
        entries = snap.docs.map((d) => {
          const data = d.data();
          return {
            pct: Number(data.analysis?.freshnessPercentage ?? 0),
            salvage: String(data.analysis?.salvageValue || ""),
          };
        });
      } catch {}
    }

    setTotalScans(entries.length);
    const rescued = entries.filter((e) => e.pct >= 40);
    setSavedFruits(rescued.length);

    // Akumulasi estimasi rupiah dari salvageValue (misal "Rp 15.000/kg" -> 15000)
    let totalRupiah = 0;
    rescued.forEach((e) => {
      const match = e.salvage.replace(/\./g, "").match(/(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val >= 1000 && val <= 10000000) {
          totalRupiah += val;
        }
      }
    });

    if (totalRupiah >= 1000000) {
      setSavedValueLabel(`Rp ${(totalRupiah / 1000000).toFixed(1)} Jt`);
    } else if (totalRupiah >= 1000) {
      setSavedValueLabel(`Rp ${Math.round(totalRupiah / 1000)} Rb`);
    } else {
      setSavedValueLabel(`Rp ${totalRupiah}`);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

  const toggleDefaultMode = async () => {
    const nextMode = defaultMode === "Pribadi" ? "Bisnis" : "Pribadi";
    setDefaultMode(nextMode);
    await AsyncStorage.setItem("@freshia_default_mode", nextMode);
  };

  const toggleReminder = async (value: boolean) => {
    setReminderEnabled(value);
    await AsyncStorage.setItem("@freshia_reminder_enabled", String(value));
  };

  const displayName =
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : "Pengguna Freshia");
  const displayEmail = user?.email || "user@freshia.com";
  const activeAvatarUri = customPhoto || user?.photoURL || null;
  const isGoogleProvider = user?.providerData?.some(
    (p) => p.providerId === "google.com",
  );

  const handleSendFeedback = () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      if (Platform.OS === "web") {
        window.alert("Silakan login terlebih dahulu.");
      } else {
        Alert.alert("Login Diperlukan", "Silakan login terlebih dahulu untuk memberi feedback.");
      }
      return;
    }
    setFeedbackModalVisible(true);
  };

  const handleSubmitFeedback = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !feedbackText.trim()) return;
    setSendingFeedback(true);
    try {
      await submitFeedback({
        userId,
        rating: feedbackRating,
        comment: feedbackText.trim(),
        category: "general",
        appVersion: "1.0.0",
      });
      setFeedbackModalVisible(false);
      setFeedbackText("");
      setFeedbackRating(5);
      if (Platform.OS === "web") {
        window.alert("Terima kasih atas feedback Anda!");
      } else {
        Alert.alert("Terima Kasih", "Feedback berhasil dikirim!");
      }
    } catch {
      if (Platform.OS === "web") {
        window.alert("Gagal mengirim feedback.");
      } else {
        Alert.alert("Error", "Gagal mengirim feedback. Coba lagi nanti.");
      }
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut(auth);
      setLogoutModalVisible(false);
      router.replace("/welcome");
    } catch (error: any) {
      const msg = error?.message || "Gagal keluar dari akun.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setDeletingAccount(true);
    try {
      // Hapus dokumen scan_history milik user di Firestore
      const q = query(
        collection(db, "scan_history"),
        where("user_id", "==", currentUser.uid),
      );
      const snap = await getDocs(q);
      await Promise.allSettled(
        snap.docs.map((d) => deleteDoc(doc(db, "scan_history", d.id))),
      );

      // Hapus dokumen profil user di Firestore
      await deleteDoc(doc(db, "users", currentUser.uid)).catch(() => {});

      // Hapus cache lokal
      await AsyncStorage.removeItem("@freshia_history");
      await AsyncStorage.removeItem(`@freshia_avatar_${currentUser.uid}`);

      // Hapus akun Firebase Auth
      await deleteUser(currentUser);
      setDeleteModalVisible(false);
      router.replace("/welcome");
    } catch (error: any) {
      setDeleteModalVisible(false);
      const msg =
        error?.code === "auth/requires-recent-login"
          ? "Demi keamanan, silakan keluar lalu masuk kembali sebelum menghapus akun."
          : error?.message || "Gagal menghapus akun.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Konfirmasi Keamanan", msg);
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleInformationPersonal = () => {
    router.push("/edit-profile");
  };

  const handleChangePassword = () => {
    router.push("/change-password");
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header Merah */}
      <View style={styles.headerSection}>
        {/* Top Bar: Logo Freshia & Ikon Logout */}
        <View style={styles.topBar}>
          <Image
            source={require("../../../assets/images/freshia-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity
            onPress={() => setLogoutModalVisible(true)}
            style={styles.logoutIconButton}
            activeOpacity={0.7}
            accessibilityLabel="Keluar Akun"
          >
            <Ionicons name="exit-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Foto Profil & Identitas User */}
        <View style={styles.profileInfo}>
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.85}
            onPress={handleInformationPersonal}
          >
            <View style={styles.avatarWrapper}>
              {activeAvatarUri && !imgError ? (
                Platform.OS === "web" ? (
                  <img
                    src={activeAvatarUri}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: 52,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: activeAvatarUri }}
                    style={styles.avatar}
                    onError={() => setImgError(true)}
                  />
                )
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={54} color="#9A1B17" />
                </View>
              )}
            </View>
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>

          <View style={styles.providerBadge}>
            <Ionicons
              name={isGoogleProvider ? "logo-google" : "mail-outline"}
              size={12}
              color="#FFFFFF"
            />
            <Text style={styles.providerBadgeText}>
              {isGoogleProvider ? "Akun Google Terhubung" : "Akun Email"}
            </Text>
          </View>
        </View>
      </View>

      {/* Konten Bawah Putih Melengkung */}
      <View style={styles.contentCard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Ringkasan Dampak Freshia */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalScans}</Text>
              <Text style={styles.statLabel}>Total Scan</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{savedFruits}</Text>
              <Text style={styles.statLabel}>Terselamatkan</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{savedValueLabel}</Text>
              <Text style={styles.statLabel}>Estimasi Nilai</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Account Overview</Text>

          {/* Menu 1: Information Personal */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={handleInformationPersonal}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons
                name="person-circle-outline"
                size={28}
                color="#9A1B17"
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuText}>Information Personal</Text>
              <Text style={styles.menuSubText}>
                Ubah nama tampilan & foto profil
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A1B17" />
          </TouchableOpacity>

          {/* Menu 2: Change Password */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={handleChangePassword}
          >
            <View style={styles.menuIconCircle}>
              <MaterialCommunityIcons
                name="shield-half-full"
                size={26}
                color="#9A1B17"
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuText}>Change Password</Text>
              <Text style={styles.menuSubText}>
                {isGoogleProvider
                  ? "Dikelola melalui keamanan Google"
                  : "Perbarui kata sandi akun"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A1B17" />
          </TouchableOpacity>

          {/* Bagian Preferensi Aplikasi */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            Preferensi Aplikasi
          </Text>

          {/* Default Scan Mode */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={toggleDefaultMode}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons
                name={
                  defaultMode === "Bisnis"
                    ? "briefcase-outline"
                    : "home-outline"
                }
                size={24}
                color="#9A1B17"
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuText}>Mode Scan Default</Text>
              <Text style={styles.menuSubText}>
                Saat ini: Mode {defaultMode} (ketuk untuk ganti)
              </Text>
            </View>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>{defaultMode}</Text>
            </View>
          </TouchableOpacity>

          {/* Notifikasi Pengingat Buah */}
          <View style={styles.menuItem}>
            <View style={styles.menuIconCircle}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color="#9A1B17"
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuText}>Reminder Buah Hampir Busuk</Text>
              <Text style={styles.menuSubText}>
                Tampilkan peringatan masa simpan buah
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={toggleReminder}
              trackColor={{ false: "#E0D6D6", true: "#F4A4A1" }}
              thumbColor={reminderEnabled ? "#C8201B" : "#F4F3F4"}
            />
          </View>

          {/* Feedback Button */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={handleSendFeedback}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={24}
                color="#9A1B17"
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuText}>Beri Feedback</Text>
              <Text style={styles.menuSubText}>
                Bantu kami meningkatkan Freshia
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A1B17" />
          </TouchableOpacity>

          {/* Zona Keamanan & Hapus Akun */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            Keamanan & Data
          </Text>

          <TouchableOpacity
            style={[styles.menuItem, styles.dangerMenuItem]}
            activeOpacity={0.75}
            onPress={() => setDeleteModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="trash-outline" size={24} color="#C8201B" />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuText, { color: "#C8201B" }]}>
                Hapus Akun Permanen
              </Text>
              <Text style={styles.menuSubText}>
                Hapus akun beserta seluruh riwayat scan
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C8201B" />
          </TouchableOpacity>

          <Text style={styles.versionText}>Freshia Production v1.0.0</Text>
        </ScrollView>
      </View>

      {/* Pop-up Modal Konfirmasi Keluar Akun */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loggingOut) {
            setLogoutModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setLogoutModalVisible(false)}
              disabled={loggingOut}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#333333" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Keluar Akun</Text>
            <Text style={styles.modalSubtitle}>
              Anda yakin ingin keluar dari akun ini?
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.yesButton, loggingOut && { opacity: 0.7 }]}
                onPress={handleConfirmLogout}
                disabled={loggingOut}
                activeOpacity={0.85}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.yesButtonText}>Ya</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setLogoutModalVisible(false)}
                disabled={loggingOut}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Kembali</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pop-up Modal Konfirmasi Hapus Akun Permanen */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingAccount) {
            setDeleteModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDeleteModalVisible(false)}
              disabled={deletingAccount}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#333333" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Hapus Akun</Text>
            <Text style={styles.modalSubtitle}>
              Semua data profil dan riwayat pemindaian buah akan dihapus
              permanen dan tidak dapat dipulihkan.
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.yesButton, deletingAccount && { opacity: 0.7 }]}
                onPress={handleConfirmDeleteAccount}
                disabled={deletingAccount}
                activeOpacity={0.85}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.yesButtonText}>Hapus</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deletingAccount}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Pop-up Modal Feedback */}
      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sendingFeedback) {
            setFeedbackModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setFeedbackModalVisible(false)}
              disabled={sendingFeedback}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#333333" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Feedback Freshia</Text>
            <Text style={styles.modalSubtitle}>
              Beri rating dan tulis komentar untuk membantu kami meningkatkan
              aplikasi.
            </Text>

            {/* Star Rating */}
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setFeedbackRating(star)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= feedbackRating ? "star" : "star-outline"}
                    size={30}
                    color={star <= feedbackRating ? "#FFB800" : "#CCC"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.feedbackInput}
              placeholder="Tulis komentar atau saran..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
              textAlignVertical="top"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[
                  styles.yesButton,
                  (sendingFeedback || !feedbackText.trim()) && { opacity: 0.7 },
                ]}
                onPress={handleSubmitFeedback}
                disabled={sendingFeedback || !feedbackText.trim()}
                activeOpacity={0.85}
              >
                {sendingFeedback ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.yesButtonText}>Kirim</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setFeedbackModalVisible(false)}
                disabled={sendingFeedback}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#C8201B",
  },
  headerSection: {
    backgroundColor: "#C8201B",
    paddingTop: Platform.OS === "ios" ? 56 : 42,
    paddingBottom: 26,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  logo: {
    width: 105,
    height: 36,
  },
  logoutIconButton: {
    padding: 6,
  },
  profileInfo: {
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarFallback: {
    width: 104,
    height: 104,
    backgroundColor: "#FDECEC",
    justifyContent: "center",
    alignItems: "center",
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#8E1612",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  userEmail: {
    fontSize: 13,
    color: "#F8E5E5",
    marginBottom: 8,
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  providerBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contentCard: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 110,
  },

  /* Kartu Statistik Dampak */
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#9A1B17",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#7A2825",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E8BCBA",
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9A1B17",
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#9A1B17",
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  dangerMenuItem: {
    borderColor: "#E5A5A3",
    backgroundColor: "#FFF8F8",
  },
  menuIconCircle: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuTextGroup: {
    flex: 1,
    paddingRight: 8,
  },
  menuText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#9A1B17",
  },
  menuSubText: {
    fontSize: 11.5,
    color: "#7A6A6A",
    marginTop: 1,
  },
  modePill: {
    backgroundColor: "#FCE8E8",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9A1B17",
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  feedbackInput: {
    width: "100%",
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E0D6D6",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: "#333",
    marginBottom: 20,
    backgroundColor: "#FAFAFA",
  },
  versionText: {
    textAlign: "center",
    fontSize: 11.5,
    color: "#A89898",
    marginTop: 8,
  },

  /* Modal Logout & Delete Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 16,
    padding: 6,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#222222",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    width: "100%",
  },
  yesButton: {
    flex: 1,
    height: 40,
    backgroundColor: "#9A1B17",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  yesButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    height: 40,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#9A1B17",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#9A1B17",
    fontSize: 14,
    fontWeight: "500",
  },
});
