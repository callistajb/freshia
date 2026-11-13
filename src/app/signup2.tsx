import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
} from "firebase/auth";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { useGoogleAuth } from "../hooks/useGoogleAuth";

export default function SignUpStepTwoScreen() {
  const { fullName, email } = useLocalSearchParams<{
    fullName?: string;
    email?: string;
  }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { handleGoogleSignIn, googleLoading, disabled } = useGoogleAuth();

  const showNotification = (
    title: string,
    message: string,
    onConfirm?: () => void,
  ) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
      if (onConfirm) onConfirm();
    } else {
      Alert.alert(
        title,
        message,
        onConfirm ? [{ text: "OK", onPress: onConfirm }] : undefined,
      );
    }
  };

  const handleRegister = async () => {
    if (!email) {
      showNotification(
        "Perhatian",
        "Data nama dan email tidak ditemukan. Silakan isi tahap pertama terlebih dahulu.",
        () => router.replace("/login"),
      );
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      showNotification(
        "Perhatian",
        "Masukkan kata sandi dan ulangi kata sandi terlebih dahulu.",
      );
      return;
    }

    if (password !== confirmPassword) {
      showNotification(
        "Perhatian",
        "Kata sandi dan ulangi kata sandi tidak cocok.",
      );
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      if (fullName) {
        await updateProfile(userCredential.user, {
          displayName: fullName.trim(),
        });
      }

      await signOut(auth);
      showNotification(
        "Berhasil Mendaftar",
        "Akun berhasil dibuat. Silakan login menggunakan akun Anda.",
        () => router.replace("/signin"),
      );
    } catch (error: any) {
      let errorMessage = "Terjadi kesalahan saat mendaftar.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email ini sudah terdaftar. Silakan masuk.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Format email tidak valid.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Kata sandi minimal harus 6 karakter.";
      }
      showNotification("Gagal Mendaftar", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#E0211A", "#7E0907", "#160202"]}
      locations={[0, 0.45, 1]}
      style={styles.container}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Logo Freshia */}
          <View style={styles.header}>
            <Image
              source={require("../../assets/images/freshia-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form Sign Up Tahap 2 */}
          <View style={styles.formContainer}>
            <Text style={styles.heading}>Sign Up</Text>

            {/* Input Buat Kata Sandi */}
            <Text style={styles.label}>Buat Kata Sandi</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Buat kata sandi"
                placeholderTextColor="#8E8E93"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#6E6E73"
                />
              </TouchableOpacity>
            </View>

            {/* Input Ulangi Kata Sandi */}
            <Text style={styles.label}>Ulangi kata sandi</Text>
            <View style={[styles.inputWrapper, { marginBottom: 28 }]}>
              <TextInput
                style={styles.input}
                placeholder="Ulangi kata sandi"
                placeholderTextColor="#8E8E93"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#6E6E73"
                />
              </TouchableOpacity>
            </View>

            {/* Tombol Masuk */}
            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.85}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Masuk</Text>
              )}
            </TouchableOpacity>

            {/* Pembatas "Atau daftar dengan" */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Atau daftar dengan</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Tombol Google */}
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.85}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || disabled}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1C1C1E" />
              ) : (
                <>
                  <Image
                    source={require("../../assets/images/google-icon.png")}
                    style={styles.googleIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Masuk */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.push("/signin")}>
              <Text style={styles.footerLink}>Masuk di sini</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 170,
    height: 60,
  },
  formContainer: {
    width: "100%",
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1C1C1E",
    paddingRight: 10,
  },
  loginButton: {
    backgroundColor: "#C8201B",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 26,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  dividerText: {
    color: "#D1C7C7",
    fontSize: 12,
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  googleButtonText: {
    color: "#1C1C1E",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    color: "#D1C7C7",
    fontSize: 13,
  },
  footerLink: {
    color: "#E0211A",
    fontSize: 13,
    fontWeight: "700",
  },
});
