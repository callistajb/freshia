import {
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
} from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { auth } from "../firebaseConfig";
import { createOrUpdateUserProfile } from "../services/firestoreService";

if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

const WEB_CLIENT_ID =
  "871076206639-ht4gn47j53ug1i0ekq1v7vb655rfgthm.apps.googleusercontent.com";

// Gunakan makeRedirectUri() agar otomatis bekerja di Expo Go, dev build, maupun standalone
const REDIRECT_URI = makeRedirectUri({
  scheme: "freshia",
  // Untuk Expo Go di dev, akan otomatis menggunakan scheme exp://
  // Untuk standalone build, akan menggunakan scheme "freshia"
});

export function useGoogleAuth() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const extraParams = useMemo(
    () => ({
      nonce: "freshia_nonce_" + Math.random().toString(36).substring(2),
    }),
    [],
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: WEB_CLIENT_ID,
    iosClientId: WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
    redirectUri: REDIRECT_URI,
  });

  const showError = (message: string) => {
    if (Platform.OS === "web") {
      window.alert(`Gagal Login Google: ${message}`);
    } else {
      Alert.alert("Gagal Login Google", message);
    }
  };

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (response?.type === "success") {
      const { id_token } = response.params;
      const token = id_token;
      if (token) {
        const credential = GoogleAuthProvider.credential(token);
        setGoogleLoading(true);
        signInWithCredential(auth, credential)
          .then((userCredential) => {
            // Simpan profil user Google ke Firestore
            createOrUpdateUserProfile({
              uid: userCredential.user.uid,
              displayName: userCredential.user.displayName || "User",
              email: userCredential.user.email || "",
              photoURL: userCredential.user.photoURL || undefined,
              provider: "google",
            }).catch(() => {}); // Fire-and-forget
            router.replace("/(tabs)");
          })
          .catch((err) => {
            showError(err.message);
          })
          .finally(() => {
            setGoogleLoading(false);
          });
      }
    } else if (response?.type === "error") {
      showError(
        response.error?.description ||
          "Autentikasi Google dibatalkan atau gagal.",
      );
    }
  }, [response]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      if (Platform.OS === "web") {
        // Web: gunakan Firebase popup langsung
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        // Simpan profil user Google ke Firestore
        createOrUpdateUserProfile({
          uid: result.user.uid,
          displayName: result.user.displayName || "User",
          email: result.user.email || "",
          photoURL: result.user.photoURL || undefined,
          provider: "google",
        }).catch(() => {}); // Fire-and-forget
        router.replace("/(tabs)");
      } else if (promptAsync) {
        // Mobile: gunakan expo-auth-session Google provider
        await promptAsync();
        // Response akan ditangkap oleh useEffect di atas
      } else {
        showError(
          "Google Sign-In belum siap. Pastikan koneksi internet aktif, lalu coba lagi.",
        );
      }
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        showError(
          error.message || "Terjadi kesalahan saat masuk dengan Google.",
        );
      }
    } finally {
      // Untuk mobile, loading state ditangani oleh useEffect setelah response
      if (Platform.OS === "web") {
        setGoogleLoading(false);
      }
    }
  };

  return {
    handleGoogleSignIn,
    googleLoading,
    disabled: Platform.OS !== "web" && !request,
  };
}
