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
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { auth } from "../firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID =
  "871076206639-ht4gn47j53ug1i0ekq1v7vb655rfgthm.apps.googleusercontent.com";
const PROXY_REDIRECT_URI = "https://auth.expo.io/@sorye/freshia";

export function useGoogleAuth() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: WEB_CLIENT_ID,
      redirectUri: PROXY_REDIRECT_URI,
      responseType: ResponseType.IdToken,
      usePKCE: false,
      scopes: ["openid", "profile", "email"],
      extraParams: {
        nonce: "freshia_nonce_" + Math.random().toString(36).substring(2),
      },
    },
    Google.discovery,
  );

  const showError = (message: string) => {
    if (Platform.OS === "web") {
      window.alert(`Gagal Login Google: ${message}`);
    } else {
      Alert.alert("Gagal Login Google", message);
    }
  };

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setGoogleLoading(true);
      signInWithCredential(auth, credential)
        .then(() => {
          router.replace("/(tabs)");
        })
        .catch((err) => {
          showError(err.message);
        })
        .finally(() => {
          setGoogleLoading(false);
        });
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
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        router.replace("/(tabs)");
      } else if (request) {
        // Beri tahu auth.expo.io alamat lokal Expo Go (exp://...) untuk kembali
        const returnUrl = makeRedirectUri();
        const authUrl = await request.makeAuthUrlAsync(Google.discovery);
        const startUrl = `${PROXY_REDIRECT_URI}/start?${new URLSearchParams({
          authUrl,
          returnUrl,
        }).toString()}`;

        const result = await WebBrowser.openAuthSessionAsync(
          startUrl,
          returnUrl,
        );

        if (result.type === "success" && result.url) {
          // Ambil id_token dari URL kembalian (baik di hash # maupun query ?)
          const urlObj = new URL(result.url.replace("#", "?"));
          const idToken = urlObj.searchParams.get("id_token");
          if (idToken) {
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
            router.replace("/(tabs)");
          } else {
            showError("Token Google tidak ditemukan pada respons.");
          }
        }
      }
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        showError(
          error.message || "Terjadi kesalahan saat masuk dengan Google.",
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return {
    handleGoogleSignIn,
    googleLoading,
    disabled: Platform.OS !== "web" && !request,
  };
}
