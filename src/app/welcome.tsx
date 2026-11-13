import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={["#E0211A", "#8B0B08", "#1C0303"]}
      locations={[0, 0.55, 1]}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Ornamen Daun Kiri Atas */}
      <Image
        source={require("../../assets/images/daun.png")}
        style={styles.leafTopLeft}
        resizeMode="contain"
      />

      {/* Ornamen Daun Kanan Tengah */}
      <Image
        source={require("../../assets/images/daun.png")}
        style={styles.leafMidRight}
        resizeMode="contain"
      />

      {/* Ilustrasi Karakter Maskot */}
      <View style={styles.mascotContainer}>
        <Image
          source={require("../../assets/images/mascot.png")}
          style={styles.mascotImage}
          resizeMode="contain"
        />
      </View>

      {/* Konten Bawah (Logo, Tagline & Tombol) */}
      <View style={styles.bottomSection}>
        {/* Logo Freshia */}
        <Image
          source={require("../../assets/images/freshia-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Know Your Fruit Better</Text>
        <Text style={styles.subtitle}>
          Kenali tingkat kesegarannya dalam sekali cek.
        </Text>

        {/* Tombol Sign Up */}
        <TouchableOpacity
          style={styles.signUpButton}
          activeOpacity={0.85}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signUpButtonText}>Sign Up</Text>
        </TouchableOpacity>

        {/* Tombol I have an account */}
        <TouchableOpacity
          style={styles.loginOutlineButton}
          activeOpacity={0.85}
          onPress={() => router.push("/signin")}
        >
          <Text style={styles.loginOutlineButtonText}>I have an account</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: "100%",
    width: "100%",
    justifyContent: "space-between",
    backgroundColor: "#1C0303",
    ...(Platform.OS === "web" && {
      // Mengatasi sisa putih pas di-inspect web agar ikut gelap menyatu
      minHeight: "100vh",
    }),
  },
  leafTopLeft: {
    position: "absolute",
    top: -10,
    left: -20,
    width: 170,
    height: 170,
    opacity: 0.9,
  },
  leafMidRight: {
    position: "absolute",
    top: height * 0.28,
    right: -25,
    width: 130,
    height: 130,
    opacity: 0.9,
  },
  mascotContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 50,
  },
  mascotImage: {
    width: width * 0.85,
    height: height * 0.45,
  },
  bottomSection: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 10,
  },
  logo: {
    width: 120,
    height: 45,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#E0D6D6",
    marginBottom: 28,
  },
  signUpButton: {
    backgroundColor: "#C8201B",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  signUpButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginOutlineButton: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  loginOutlineButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
});
