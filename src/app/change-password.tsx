import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
} from "firebase/auth";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth } from "../firebaseConfig";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const isGoogleProvider = user?.providerData?.some(
    (p) => p.providerId === "google.com",
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const showMessage = (title: string, msg: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage("Validasi", "Semua kolom kata sandi wajib diisi.");
      return;
    }
    if (newPassword.length < 6) {
      showMessage("Validasi", "Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage("Validasi", "Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      showMessage("Berhasil", "Kata sandi akun berhasil diperbarui.");
      router.back();
    } catch (error: any) {
      let msg = "Gagal memperbarui kata sandi.";
      if (
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-credential"
      ) {
        msg = "Kata sandi lama yang Anda masukkan salah.";
      } else if (error?.code === "auth/weak-password") {
        msg = "Kata sandi baru terlalu lemah (minimal 6 karakter).";
      } else if (error?.message) {
        msg = error.message;
      }
      showMessage("Gagal", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header Merah */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.cardBody}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isGoogleProvider ? (
            <View style={styles.infoBox}>
              <Ionicons name="logo-google" size={36} color="#9A1B17" />
              <Text style={styles.infoTitle}>Akun Terhubung dengan Google</Text>
              <Text style={styles.infoDesc}>
                Anda masuk menggunakan akun Google ({user?.email}). Pengaturan
                kata sandi dan keamanan dua langkah dikelola langsung melalui
                halaman Akun Google Anda.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Kembali ke Profil</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.helperIntro}>
                Gunakan kombinasi minimal 6 karakter huruf dan angka untuk
                menjaga keamanan akun Freshia Anda.
              </Text>

              {/* Password Lama */}
              <Text style={styles.label}>Kata Sandi Saat Ini</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#9A1B17"
                />
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Masukkan kata sandi lama"
                  placeholderTextColor="#A09090"
                  secureTextEntry={!showCurrent}
                />
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                  <Ionicons
                    name={showCurrent ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Baru */}
              <Text style={styles.label}>Kata Sandi Baru</Text>
              <View style={styles.inputBox}>
                <Ionicons name="key-outline" size={20} color="#9A1B17" />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Minimal 6 karakter"
                  placeholderTextColor="#A09090"
                  secureTextEntry={!showNew}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Ionicons
                    name={showNew ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              {/* Konfirmasi Password Baru */}
              <Text style={styles.label}>Konfirmasi Kata Sandi Baru</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#9A1B17"
                />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Ulangi kata sandi baru"
                  placeholderTextColor="#A09090"
                  secureTextEntry={!showNew}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleUpdatePassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Perbarui Kata Sandi
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => router.push("/forgot-password")}
              >
                <Text style={styles.forgotLinkText}>
                  Lupa kata sandi lama? Reset via Email
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#C8201B",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardBody: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  helperIntro: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5C4B4B",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E1612",
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#9A1B17",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1C1C1E",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  primaryButton: {
    backgroundColor: "#C8201B",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  forgotLink: {
    marginTop: 16,
    alignItems: "center",
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9A1B17",
    textDecorationLine: "underline",
  },
  infoBox: {
    backgroundColor: "#FCE8E8",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginTop: 12,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#9A1B17",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  infoDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5A3A38",
    textAlign: "center",
    marginBottom: 20,
  },
});
