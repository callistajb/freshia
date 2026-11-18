import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Menyimpan foto profil kustom (Base64) berdasarkan UID dan Email
 * agar tetap sinkron meskipun user berganti metode login (Email/Password <-> Google)
 * dengan alamat email yang sama.
 */
export async function saveCustomUserAvatar(
  user: User,
  photoBase64: string,
): Promise<void> {
  const uidKey = `@freshia_avatar_${user.uid}`;
  await AsyncStorage.setItem(uidKey, photoBase64);

  if (user.email) {
    const emailKey = `@freshia_avatar_email_${user.email.toLowerCase().trim()}`;
    await AsyncStorage.setItem(emailKey, photoBase64);
  }
}

/**
 * Memuat foto profil terbaik untuk user saat ini.
 * Prioritas:
 * 1. Foto kustom yang disimpan user di aplikasi (berdasarkan UID atau Email yang sama di AsyncStorage / Firestore)
 * 2. Foto bawaan dari provider (user.photoURL, misal dari Google)
 */
export async function resolveUserAvatar(
  user: User | null,
): Promise<string | null> {
  if (!user) return null;

  const uid = user.uid;
  const email = user.email ? user.email.toLowerCase().trim() : "";

  // 1. Cek cache lokal berdasarkan UID
  try {
    const cachedByUid = await AsyncStorage.getItem(`@freshia_avatar_${uid}`);
    if (cachedByUid) return cachedByUid;

    if (email) {
      const cachedByEmail = await AsyncStorage.getItem(
        `@freshia_avatar_email_${email}`,
      );
      if (cachedByEmail) {
        await AsyncStorage.setItem(`@freshia_avatar_${uid}`, cachedByEmail);
        return cachedByEmail;
      }
    }
  } catch {}

  // 2. Cek dokumen di Firestore collection "users" berdasarkan UID
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data?.photoBase64) {
        const base64Str = String(data.photoBase64);
        await saveCustomUserAvatar(user, base64Str);
        return base64Str;
      }
    }

    // 3. Jika login Google membuat/memakai dokumen berbeda tapi email-nya sama, cari berdasarkan email
    if (email) {
      const q = query(
        collection(db, "users"),
        where("email", "==", user.email),
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        if (data?.photoBase64) {
          const base64Str = String(data.photoBase64);
          await saveCustomUserAvatar(user, base64Str);
          // Sinkronkan juga ke doc UID aktif
          await setDoc(
            doc(db, "users", uid),
            { photoBase64: base64Str },
            { merge: true },
          ).catch(() => {});
          return base64Str;
        }
      }
    }
  } catch {}

  return user.photoURL || null;
}
