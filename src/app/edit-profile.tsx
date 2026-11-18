import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { sendEmailVerification, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
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
import { auth, db } from "../firebaseConfig";
import { resolveUserAvatar, saveCustomUserAvatar } from "../utils/avatarSync";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(
    user?.displayName || (user?.email ? user.email.split("@")[0] : ""),
  );
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(
    user?.photoURL || null,
  );
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);

  useEffect(() => {
    const loadExtraProfile = async () => {
      if (!user?.uid) return;
      try {
        const resolvedAvatar = await resolveUserAvatar(user);
        if (resolvedAvatar) {
          setPhotoUri(resolvedAvatar);
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.phone) {
            setPhone(String(data.phone).replace(/[^0-9+]/g, ""));
          }
          if (data.businessName) setBusinessName(String(data.businessName));
          if (data.photoBase64) {
            setPhotoUri(String(data.photoBase64));
          }
        }
      } catch (err) {
        console.warn("Gagal memuat detail profil tambahan:", err);
      }
    };
    loadExtraProfile();
  }, [user]);

  const showMessage = (title: string, msg: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  // Filter input Nomor Telepon agar HANYA bisa diisi angka (dan tanda + di awal)
  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9+]/g, "");
    // Pastikan tanda + hanya boleh di karakter pertama
    const normalized =
      cleaned.startsWith("+")
        ? "+" + cleaned.slice(1).replace(/\+/g, "")
        : cleaned.replace(/\+/g, "");
    setPhone(normalized.slice(0, 15));
  };

  // Filter Nama Lengkap agar tidak diisi karakter/simbol acak atau angka
  const handleNameChange = (text: string) => {
    const cleaned = text.replace(/[^a-zA-Z\s.,'-]/g, "");
    setDisplayName(cleaned);
  };

  // Kompres gambar menjadi Base64 kecil agar aman disimpan di Firestore (maks 1MB/dokumen)
  const compressToBase64 = async (
    uri: string,
    rawBase64?: string | null,
  ): Promise<string> => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 240;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.55));
          } else {
            resolve(rawBase64 ? `data:image/jpeg;base64,${rawBase64}` : uri);
          }
        };
        img.onerror = () => {
          resolve(rawBase64 ? `data:image/jpeg;base64,${rawBase64}` : uri);
        };
        img.src = uri;
      });
    }

    if (rawBase64) {
      return `data:image/jpeg;base64,${rawBase64}`;
    }
    return uri;
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showMessage(
        "Izin Galeri",
        "Mohon izinkan akses galeri untuk mengganti foto profil.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      const compressedDataUrl = await compressToBase64(asset.uri, asset.base64);
      setPhotoUri(compressedDataUrl);
      setNewPhotoBase64(compressedDataUrl);
    }
  };

  const handleSendVerification = async () => {
    if (!user) return;
    setSendingVerify(true);
    try {
      await sendEmailVerification(user);
      showMessage(
        "Email Terkirim",
        `Tautan verifikasi telah dikirim ke ${user.email}. Silakan cek kotak masuk atau folder spam.`,
      );
    } catch (error: any) {
      showMessage(
        "Gagal",
        error?.message || "Gagal mengirim email verifikasi.",
      );
    } finally {
      setSendingVerify(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      showMessage(
        "Validasi Nama",
        "Nama lengkap minimal harus terdiri dari 2 huruf dan tidak boleh berisi angka.",
      );
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone.length > 0) {
      const digitsOnly = trimmedPhone.replace(/[^0-9]/g, "");
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        showMessage(
          "Validasi Nomor Telepon",
          "Nomor WhatsApp / Telepon harus berupa angka valid (10 hingga 15 digit).",
        );
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Update displayName di Firebase Auth Profile
      await updateProfile(user, {
        displayName: trimmedName,
      });

      // 2. Siapkan payload Firestore (termasuk foto Base64 jika baru diganti)
      const userPayload: Record<string, any> = {
        uid: user.uid,
        displayName: trimmedName,
        email: user.email || "",
        phone: trimmedPhone,
        businessName: businessName.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (newPhotoBase64) {
        userPayload.photoBase64 = newPhotoBase64;
        await saveCustomUserAvatar(user, newPhotoBase64);
      } else if (photoUri && photoUri.startsWith("data:image")) {
        userPayload.photoBase64 = photoUri;
        await saveCustomUserAvatar(user, photoUri);
      }

      // 3. Simpan ke Firestore (collection: users)
      await setDoc(doc(db, "users", user.uid), userPayload, { merge: true });

      showMessage("Berhasil", "Informasi personal berhasil diperbarui.");
      router.back();
    } catch (error: any) {
      showMessage(
        "Gagal Menyimpan",
        error?.message || "Terjadi kesalahan saat menyimpan profil.",
      );
    } finally {
      setSaving(false);
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
        <Text style={styles.headerTitle}>Information Personal</Text>
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
          {/* Foto Profil */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={handlePickAvatar}
              activeOpacity={0.85}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={50} color="#9A1B17" />
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoHint}>
              Ketuk foto untuk mengganti gambar profil
            </Text>
          </View>

          {/* Input Nama Lengkap */}
          <Text style={styles.label}>Nama Lengkap</Text>
          <View style={styles.inputBox}>
            <Ionicons name="person-outline" size={20} color="#9A1B17" />
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={handleNameChange}
              placeholder="Masukkan nama lengkap (hanya huruf)"
              placeholderTextColor="#A09090"
              maxLength={50}
            />
          </View>

          {/* Input Email (Read-Only + Status Verifikasi) */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>Alamat Email</Text>
            <View
              style={[
                styles.verifyBadge,
                user?.emailVerified
                  ? styles.verifyBadgeGood
                  : styles.verifyBadgeWarn,
              ]}
            >
              <Text
                style={[
                  styles.verifyBadgeText,
                  user?.emailVerified
                    ? styles.verifyBadgeTextGood
                    : styles.verifyBadgeTextWarn,
                ]}
              >
                {user?.emailVerified ? "Terverifikasi" : "Belum Verifikasi"}
              </Text>
            </View>
          </View>
          <View style={[styles.inputBox, styles.inputDisabled]}>
            <Ionicons name="mail-outline" size={20} color="#8E8E93" />
            <TextInput
              style={[styles.input, { color: "#7A7A7A" }]}
              value={user?.email || ""}
              editable={false}
            />
          </View>
          {!user?.emailVerified && (
            <TouchableOpacity
              onPress={handleSendVerification}
              disabled={sendingVerify}
              style={styles.verifyActionLink}
            >
              <Text style={styles.verifyActionText}>
                {sendingVerify
                  ? "Mengirim email verifikasi..."
                  : "Kirim ulang email verifikasi"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Input Nomor WhatsApp / Telepon */}
          <Text style={styles.label}>Nomor WhatsApp / Telepon (Opsional)</Text>
          <View style={styles.inputBox}>
            <Ionicons name="call-outline" size={20} color="#9A1B17" />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="Contoh: 081234567890 (hanya angka)"
              placeholderTextColor="#A09090"
              keyboardType="numeric"
              inputMode="numeric"
              maxLength={15}
            />
          </View>

          {/* Input Nama Toko / Usaha (Untuk Mode Bisnis) */}
          <Text style={styles.label}>
            Nama Toko / Usaha Buah (Opsional - Mode Bisnis)
          </Text>
          <View style={styles.inputBox}>
            <Ionicons name="storefront-outline" size={20} color="#9A1B17" />
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Contoh: Toko Buah Segar Jaya"
              placeholderTextColor="#A09090"
              maxLength={60}
            />
          </View>

          {/* Tombol Simpan */}
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
            )}
          </TouchableOpacity>
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
    paddingTop: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 22,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FDECEC",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    borderWidth: 2,
    borderColor: "#9A1B17",
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#C8201B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  changePhotoHint: {
    fontSize: 12,
    color: "#7A6A6A",
    marginTop: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E1612",
    marginBottom: 6,
  },
  verifyBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  verifyBadgeGood: {
    backgroundColor: "#D8F5DC",
  },
  verifyBadgeWarn: {
    backgroundColor: "#FCE0E0",
  },
  verifyBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  verifyBadgeTextGood: {
    color: "#2E8B47",
  },
  verifyBadgeTextWarn: {
    color: "#C8201B",
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
  inputDisabled: {
    backgroundColor: "#F5EFEF",
    borderColor: "#D5C6C6",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1C1C1E",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  verifyActionLink: {
    marginTop: -10,
    marginBottom: 16,
    alignSelf: "flex-end",
  },
  verifyActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C8201B",
    textDecorationLine: "underline",
  },
  saveButton: {
    backgroundColor: "#C8201B",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
