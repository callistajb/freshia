/**
 * firestoreService.ts
 * =====================
 * Service terpusat untuk semua operasi Firebase Firestore di Freshia.
 *
 * Collections:
 * - users           → Profil user (dibuat saat sign up / login pertama kali)
 * - scan_history    → Hasil scan buah dari AI (Roboflow + Gemini)
 * - saved_recipes   → Resep yang disimpan/difavoritkan user
 * - reminders       → Reminder buah yang diatur user
 * - app_feedback    → Feedback / rating dari user
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ============================================================
// TYPES
// ============================================================

/** Profil user tersimpan di Firestore */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  provider: "email" | "google";
  createdAt: any; // Firestore Timestamp
  lastLoginAt: any;
  totalScans: number;
  preferences?: {
    defaultMode?: "Bisnis" | "Pribadi";
    notifications?: boolean;
  };
}

/** Entry resep yang disimpan user */
export interface SavedRecipe {
  id?: string;
  userId: string;
  title: string;
  subtitle: string;
  fruitName: string;
  prepTime: string;
  difficulty: string;
  calories: string;
  ingredients: string[];
  steps: string[];
  imageUri?: string;
  savedAt: any;
}

/** Reminder buah yang diatur oleh user */
export interface ReminderEntry {
  id?: string;
  userId: string;
  fruitName: string;
  scanId?: string; // referensi ke scan_history document
  expiryDate: any; // Firestore Timestamp / ISO string
  shelfLifeDays: number;
  storageTip: string;
  isConsumed: boolean;
  imageUrl?: string;
  createdAt: any;
}

/** Feedback dari user */
export interface AppFeedback {
  id?: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  category: "bug" | "feature" | "general" | "scan_accuracy";
  appVersion: string;
  createdAt: any;
}

// ============================================================
// COLLECTION REFERENCES
// ============================================================

const COLLECTIONS = {
  USERS: "users",
  SCAN_HISTORY: "scan_history",
  SAVED_RECIPES: "saved_recipes",
  REMINDERS: "reminders",
  APP_FEEDBACK: "app_feedback",
} as const;

// ============================================================
// 1. USERS COLLECTION
// ============================================================

/**
 * Buat atau update profil user di Firestore.
 * Dipanggil saat sign up baru atau login pertama kali (upsert).
 */
export const createOrUpdateUserProfile = async (params: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  provider: "email" | "google";
}): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, params.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // User sudah ada → update lastLoginAt saja
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      displayName: params.displayName || userSnap.data().displayName,
      photoURL: params.photoURL || userSnap.data().photoURL || null,
    });
  } else {
    // User baru → buat dokumen lengkap
    await setDoc(userRef, {
      uid: params.uid,
      displayName: params.displayName,
      email: params.email,
      photoURL: params.photoURL || null,
      provider: params.provider,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      totalScans: 0,
      preferences: {
        defaultMode: "Pribadi",
        notifications: true,
      },
    });
  }
};

/**
 * Ambil profil user dari Firestore.
 */
export const getUserProfile = async (
  uid: string,
): Promise<UserProfile | null> => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;
  return { uid, ...userSnap.data() } as UserProfile;
};

/**
 * Increment totalScans counter di profil user.
 * Dipanggil setelah scan berhasil tersimpan.
 */
export const incrementUserScanCount = async (uid: string): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  try {
    await updateDoc(userRef, {
      totalScans: increment(1),
    });
  } catch {
    // User doc mungkin belum ada (guest), abaikan
  }
};

/**
 * Update preferensi user (default mode, notifikasi, dll).
 */
export const updateUserPreferences = async (
  uid: string,
  preferences: Partial<NonNullable<UserProfile["preferences"]>>,
): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const updates: Record<string, any> = {};
  if (preferences?.defaultMode !== undefined) {
    updates["preferences.defaultMode"] = preferences.defaultMode;
  }
  if (preferences?.notifications !== undefined) {
    updates["preferences.notifications"] = preferences.notifications;
  }
  await updateDoc(userRef, updates);
};

// ============================================================
// 2. SCAN_HISTORY COLLECTION (sudah ada, tambah helper)
// ============================================================

/**
 * Simpan hasil scan ke Firestore.
 * Fungsi ini sudah ada di scanner.tsx, tapi kita tambahkan
 * increment scan count di profil user.
 */
export const saveScanResult = async (params: {
  userId: string | null;
  imageUrl: string;
  label: string;
  confidence: string;
  analysis: any;
  mode: string;
  parameters: any;
}): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.SCAN_HISTORY), {
    user_id: params.userId,
    imageUrl: params.imageUrl,
    label: params.label,
    confidence: params.confidence,
    analysis: params.analysis,
    mode: params.mode,
    parameters: params.parameters,
    timestamp: serverTimestamp(),
  });

  // Increment user scan count
  if (params.userId) {
    await incrementUserScanCount(params.userId);
  }

  return docRef.id;
};

/**
 * Ambil riwayat scan user dari Firestore.
 */
export const getUserScanHistory = async (
  userId: string,
  limitCount = 50,
): Promise<any[]> => {
  const historyRef = collection(db, COLLECTIONS.SCAN_HISTORY);
  const q = query(
    historyRef,
    where("user_id", "==", userId),
    orderBy("timestamp", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limitCount).map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

// ============================================================
// 3. SAVED_RECIPES COLLECTION
// ============================================================

/**
 * Simpan resep ke favorit user.
 */
export const saveRecipe = async (
  recipe: Omit<SavedRecipe, "id" | "savedAt">,
): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.SAVED_RECIPES), {
    ...recipe,
    savedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Ambil semua resep tersimpan milik user.
 */
export const getUserSavedRecipes = async (
  userId: string,
): Promise<SavedRecipe[]> => {
  const recipesRef = collection(db, COLLECTIONS.SAVED_RECIPES);
  const q = query(
    recipesRef,
    where("userId", "==", userId),
    orderBy("savedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as SavedRecipe[];
};

/**
 * Hapus resep dari favorit user.
 */
export const deleteRecipe = async (recipeId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.SAVED_RECIPES, recipeId));
};

/**
 * Cek apakah resep sudah disimpan oleh user (berdasarkan title + fruitName).
 */
export const isRecipeSaved = async (
  userId: string,
  title: string,
  fruitName: string,
): Promise<{ saved: boolean; docId?: string }> => {
  const recipesRef = collection(db, COLLECTIONS.SAVED_RECIPES);
  const q = query(
    recipesRef,
    where("userId", "==", userId),
    where("title", "==", title),
    where("fruitName", "==", fruitName),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return { saved: false };
  return { saved: true, docId: snapshot.docs[0].id };
};

// ============================================================
// 4. REMINDERS COLLECTION
// ============================================================

/**
 * Simpan reminder buah baru ke Firestore.
 */
export const saveReminder = async (
  reminder: Omit<ReminderEntry, "id" | "createdAt">,
): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.REMINDERS), {
    ...reminder,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Ambil semua reminder milik user yang belum dikonsumsi.
 */
export const getUserReminders = async (
  userId: string,
): Promise<ReminderEntry[]> => {
  const remindersRef = collection(db, COLLECTIONS.REMINDERS);
  const q = query(
    remindersRef,
    where("userId", "==", userId),
    where("isConsumed", "==", false),
    orderBy("expiryDate", "asc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as ReminderEntry[];
};

/**
 * Tandai reminder sebagai sudah dikonsumsi.
 */
export const markReminderConsumed = async (
  reminderId: string,
): Promise<void> => {
  const reminderRef = doc(db, COLLECTIONS.REMINDERS, reminderId);
  await updateDoc(reminderRef, { isConsumed: true });
};

/**
 * Hapus reminder dari Firestore.
 */
export const deleteReminder = async (reminderId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.REMINDERS, reminderId));
};

// ============================================================
// 5. APP_FEEDBACK COLLECTION
// ============================================================

/**
 * Kirim feedback dari user.
 */
export const submitFeedback = async (
  feedback: Omit<AppFeedback, "id" | "createdAt">,
): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.APP_FEEDBACK), {
    ...feedback,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Ambil semua feedback (untuk admin dashboard).
 */
export const getAllFeedback = async (): Promise<AppFeedback[]> => {
  const feedbackRef = collection(db, COLLECTIONS.APP_FEEDBACK);
  const q = query(feedbackRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as AppFeedback[];
};

// ============================================================
// STATISTIK DASHBOARD
// ============================================================

/**
 * Ambil statistik lengkap user dari Firestore.
 */
export const getUserStats = async (
  userId: string,
): Promise<{
  totalScans: number;
  savedRecipes: number;
  activeReminders: number;
  avgFreshness: number;
}> => {
  // Scan count
  const scanRef = collection(db, COLLECTIONS.SCAN_HISTORY);
  const scanQ = query(scanRef, where("user_id", "==", userId));
  const scanSnap = await getDocs(scanQ);

  let totalFreshness = 0;
  let freshCount = 0;
  scanSnap.docs.forEach((docSnap) => {
    const pct = Number(docSnap.data().analysis?.freshnessPercentage ?? 0);
    if (pct > 0) {
      totalFreshness += pct;
      freshCount++;
    }
  });

  // Saved recipes count
  const recipeRef = collection(db, COLLECTIONS.SAVED_RECIPES);
  const recipeQ = query(recipeRef, where("userId", "==", userId));
  const recipeSnap = await getDocs(recipeQ);

  // Active reminders count
  const reminderRef = collection(db, COLLECTIONS.REMINDERS);
  const reminderQ = query(
    reminderRef,
    where("userId", "==", userId),
    where("isConsumed", "==", false),
  );
  const reminderSnap = await getDocs(reminderQ);

  return {
    totalScans: scanSnap.size,
    savedRecipes: recipeSnap.size,
    activeReminders: reminderSnap.size,
    avgFreshness: freshCount > 0 ? Math.round(totalFreshness / freshCount) : 0,
  };
};
