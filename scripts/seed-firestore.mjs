import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVVirtTqOdBfqf7D_gYizG9UuM2yvvdxA",
  authDomain: "freshia-5.firebaseapp.com",
  projectId: "freshia-5",
  storageBucket: "freshia-5.firebasestorage.app",
  messagingSenderId: "871076206639",
  appId: "1:871076206639:web:299fdffd1c7b0447608eda",
  measurementId: "G-P4WPKLE1LF",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TARGET_USER_ID = "cG4Mqsch93dwQpFQyoiQO6m2IzG2";

async function run() {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(
      auth,
      "seed_temp_freshia@freshia.com",
      "FreshiaSeed123!",
    );
  } catch {
    cred = await signInWithEmailAndPassword(
      auth,
      "seed_temp_freshia@freshia.com",
      "FreshiaSeed123!",
    );
  }

  console.log("Seeding saved_recipes, reminders, and app_feedback...");

  await setDoc(doc(db, "saved_recipes", `${TARGET_USER_ID}_pai_apel_panggang`), {
    userId: TARGET_USER_ID,
    title: "Pai Apel Panggang Kayu Manis",
    subtitle: "Olahan lezat zero-waste dari apel yang mulai layu",
    fruitName: "Apel Merah",
    prepTime: "25 Menit",
    difficulty: "Mudah",
    calories: "210 kkal",
    ingredients: [
      "2 buah Apel Merah (potong dadu, buang bagian memar)",
      "2 sdm gula palem atau madu",
      "1/2 sdt bubuk kayu manis",
      "1 sdm mentega tawar",
      "Kulit pastry siap pakai secukupnya",
    ],
    steps: [
      "Kupas apel merah, buang bagian yang memar, lalu potong dadu kecil.",
      "Tumis apel bersama mentega, gula palem, dan kayu manis hingga harum.",
      "Masukkan isian apel ke dalam kulit pastry, lipat rapi.",
      "Panggang pada suhu 180°C selama 15 menit hingga kuning keemasan.",
    ],
    imageUri:
      "https://res.cloudinary.com/dqehqqz7q/image/upload/v1794922439/def_apple.jpg",
    savedAt: serverTimestamp(),
  });
  console.log("✅ saved_recipes seeded!");

  await setDoc(doc(db, "reminders", `${TARGET_USER_ID}_PpUI8I2bAxOSLOBLeARN`), {
    userId: TARGET_USER_ID,
    scanId: "PpUI8I2bAxOSLOBLeARN",
    fruitName: "Apel Merah",
    expiryDate: new Date(Date.now() + 86400000).toISOString(),
    shelfLifeDays: 1,
    storageTip: "Simpan di kulkas agar lebih awet dan segera olah hari ini",
    isConsumed: false,
    imageUrl:
      "https://res.cloudinary.com/dqehqqz7q/image/upload/v1794922439/def_apple.jpg",
    createdAt: serverTimestamp(),
  });
  console.log("✅ reminders seeded!");

  await setDoc(doc(db, "app_feedback", `${TARGET_USER_ID}_initial_feedback`), {
    userId: TARGET_USER_ID,
    rating: 5,
    comment:
      "Fitur deteksi kesegaran buah dan rekomendasi resep zero-waste sangat membantu mengurangi food waste di rumah!",
    category: "general",
    appVersion: "1.0.0",
    createdAt: serverTimestamp(),
  });
  console.log("✅ app_feedback seeded!");

  await deleteUser(cred.user).catch(() => {});
  console.log("🎉 Semua 5 collection sekarang aktif di Cloud Firestore!");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Gagal menulis ke Firestore:", err.message);
  console.error(
    "Pastikan isi file firestore.rules sudah di-copy dan di-Publish pada tab 'Rules' di Firebase Console.",
  );
  process.exit(1);
});
