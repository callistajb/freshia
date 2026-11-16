import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { auth } from "../../firebaseConfig";

export default function ResepScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setImgError(false);
    });
    return unsubscribe;
  }, []);

  const displayName =
    user?.displayName || (user?.email ? user.email.split("@")[0] : "Freshian");

  const handleSelectCategory = (kategori: "makanan" | "minuman") => {
    const judul =
      kategori === "makanan" ? "Olahan Makanan Buah" : "Olahan Minuman Buah";
    const pesan = `Daftar resep ${judul} akan segera tersedia berdasarkan buah yang kamu miliki.`;

    if (Platform.OS === "web") {
      window.alert(`${judul}\n\n${pesan}`);
    } else {
      Alert.alert(judul, pesan);
    }
  };

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

          <Text style={styles.sectionTitle}>Resep Olahan Buah</Text>
          <Text style={styles.sectionSubtitle}>
            Yuk, olah jadi resep lezat hari ini
          </Text>

          {/* Kartu 1: Olahan Makanan Buah (Ilustrasi di Kiri, Teks di Kanan) */}
          <TouchableOpacity
            style={styles.categoryCard}
            activeOpacity={0.85}
            onPress={() => handleSelectCategory("makanan")}
          >
            <Image
              source={require("../../../assets/images/apel makan.png")}
              style={styles.categoryImageLeft}
              resizeMode="contain"
            />
            <View style={styles.categoryTextWrapper}>
              <Text style={styles.categoryTitle}>Olahan Makanan Buah</Text>
            </View>
          </TouchableOpacity>

          {/* Kartu 2: Olahan Minuman Buah (Teks di Kiri, Ilustrasi di Kanan) */}
          <TouchableOpacity
            style={styles.categoryCard}
            activeOpacity={0.85}
            onPress={() => handleSelectCategory("minuman")}
          >
            <View style={styles.categoryTextWrapper}>
              <Text style={styles.categoryTitle}>Olahan Minuman Buah</Text>
            </View>
            <Image
              source={require("../../../assets/images/apel makan.png")}
              style={styles.categoryImageRight}
              resizeMode="contain"
            />
          </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8E1612",
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9A1B17",
    marginBottom: 18,
  },

  /* Kartu Kategori Resep */
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2E2",
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
    minHeight: 146,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryImageLeft: {
    width: 105,
    height: 112,
    marginRight: 12,
  },
  categoryImageRight: {
    width: 115,
    height: 112,
    marginLeft: 12,
  },
  categoryTextWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  categoryTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#8E1612",
    lineHeight: 22,
  },
});
