import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { sendPasswordResetEmail } from "firebase/auth";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();
    setStatusMessage(null);

    if (!cleanEmail) {
      setStatusMessage({
        type: "error",
        text: "Silakan masukkan alamat email yang terdaftar.",
      });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      const successText = `Tautan atur ulang kata sandi telah dikirim ke ${cleanEmail}. Silakan cek kotak masuk atau folder Spam Gmail Anda.`;
      setStatusMessage({ type: "success", text: successText });

      if (Platform.OS !== "web") {
        Alert.alert("Email Terkirim", successText, [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      let msg = "Terjadi kesalahan saat mengirim email reset kata sandi.";
      if (error.code === "auth/invalid-email") {
        msg = "Format alamat email tidak valid.";
      } else if (error.code === "auth/user-not-found") {
        msg = "Email tersebut belum terdaftar di Freshia.";
      } else if (error.code === "auth/too-many-requests") {
        msg = "Terlalu banyak percobaan. Silakan coba beberapa saat lagi.";
      }
      setStatusMessage({ type: "error", text: msg });
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tombol Kembali */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Logo Freshia */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/freshia-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form Lupa Kata Sandi */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Lupa Kata Sandi</Text>
            <Text style={styles.subtitle}>
              Masukkan email yang terdaftar. Kami akan mengirimkan tautan ke
              Gmail Anda untuk mengatur ulang kata sandi.
            </Text>

            {/* Input Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Masukkan email"
                placeholderTextColor="#8E8E93"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <Ionicons name="mail-outline" size={20} color="#6E6E73" />
            </View>

            {/* Pesan Status (Langsung muncul di Web & Mobile tanpa memblokir layar) */}
            {statusMessage && (
              <View
                style={[
                  styles.statusBox,
                  statusMessage.type === "success"
                    ? styles.statusSuccess
                    : styles.statusError,
                ]}
              >
                <Text style={styles.statusText}>{statusMessage.text}</Text>
              </View>
            )}

            {/* Tombol Kirim */}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Kirim Tautan Reset</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Kembali ke Sign In */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Ingat kata sandi Anda? </Text>
            <TouchableOpacity onPress={() => router.back()}>
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
    paddingTop: 56,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  logo: {
    width: 170,
    height: 60,
  },
  formContainer: {
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#E0D6D6",
    lineHeight: 20,
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
    paddingHorizontal: 18,
    height: 50,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1C1C1E",
    paddingRight: 10,
  },
  statusBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusSuccess: {
    backgroundColor: "rgba(46, 125, 50, 0.35)",
    borderWidth: 1,
    borderColor: "#66BB6A",
  },
  statusError: {
    backgroundColor: "rgba(211, 47, 47, 0.35)",
    borderWidth: 1,
    borderColor: "#EF5350",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#C8201B",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#FFFFFF",
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
