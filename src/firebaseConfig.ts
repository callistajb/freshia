// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
export const db = getFirestore(app);
