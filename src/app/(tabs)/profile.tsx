import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const displayName =
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : "Pengguna Freshia");
  const displayEmail = user?.email || "user@freshia.com";

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

  const handleInformationPersonal = () => {
    const info = `Nama: ${displayName}\nEmail: ${displayEmail}`;
    if (Platform.OS === "web") {
      window.alert(`Information Personal\n\n${info}`);
    } else {
      Alert.alert("Information Personal", info);
    }
  };

  const handleChangePassword = () => {
    router.push("/forgot-password");
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
          <View style={styles.avatarWrapper}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={54} color="#9A1B17" />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
        </View>
      </View>

      {/* Konten Bawah Putih Melengkung */}
      <View style={styles.contentCard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
            <Text style={styles.menuText}>Information Personal</Text>
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
            <Text style={styles.menuText}>Change Password</Text>
          </TouchableOpacity>
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
            {/* Tombol Silang (X) Pojok Kanan Atas */}
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
              {/* Tombol Ya */}
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

              {/* Tombol Kembali */}
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
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FDECEC",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: "#F8E5E5",
  },
  contentCard: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 26,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9A1B17",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#9A1B17",
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  menuIconCircle: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  menuText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#9A1B17",
  },

  /* Modal Logout Styles */
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
