import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBVVirtTqOdBfqf7D_gYizG9UuM2yvvdxA",
  authDomain: "freshia-5.firebaseapp.com",
  projectId: "freshia-5",
  storageBucket: "freshia-5.firebasestorage.app",
  messagingSenderId: "871076206639",
  appId: "1:871076206639:web:299fdffd1c7b0447608eda",
  measurementId: "G-P4WPKLE1LF",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Database Firestore (untuk fitur scan buah AI Anda)
export const db = getFirestore(app);

// Authentication (menggunakan getAuth standar yang aman untuk Expo)
export const auth = getAuth(app);
