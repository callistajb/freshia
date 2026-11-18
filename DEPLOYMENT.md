# Freshia — Deployment & Operations Guide

Dokumentasi ini menjelaskan arsitektur deployment, konfigurasi variabel lingkungan (`.env`), serta langkah-langkah menjalankan dan men-deploy aplikasi **Freshia** (IF671 Mobile Cross Platform Programming — Kelompok 5).

---

## 1. Environment & Credentials Handling (Keamanan Kredensial)

Sesuai dengan **NFR-02**, seluruh kunci API pihak ketiga disimpan di dalam berkas `.env` yang telah didaftarkan pada [`.gitignore`](file:///c:/Users/ASUS.KELLY-AMOREON/freshia/.gitignore) agar tidak terekspos ke repositori publik GitHub:

- `EXPO_PUBLIC_GEMINI_API_KEY`: API Key Google Gemini Vision (`generateContent`).
- `EXPO_PUBLIC_GEMINI_MODEL`: Model utama Gemini (misal `gemini-3.5-flash-lite` / `gemini-3.8-flash` / `gemini-2.5-flash`).
- `EXPO_PUBLIC_ROBOFLOW_API_KEY`: API Key Roboflow Object Detection.
- `EXPO_PUBLIC_ROBOFLOW_MODEL_ID`: ID Model klasifikasi buah Roboflow.
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`: Cloud name penyimpanan gambar Cloudinary CDN.
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`: Unsigned upload preset Cloudinary.

Konfigurasi layanan Firebase (`freshia-5`) berada pada [`src/firebaseConfig.ts`](file:///c:/Users/ASUS.KELLY-AMOREON/freshia/src/firebaseConfig.ts) yang mencakup **Firebase Authentication**, **Cloud Firestore** (`users` dan `scan_history`), serta **Firebase Storage**.

---

## 2. Menjalankan Aplikasi Secara Lokal (Development)

1. **Clone Repositori & Instal Dependensi:**
   ```bash
   git clone https://github.com/callistajb/freshia.git
   cd freshia
   npm install
   ```
2. **Siapkan File `.env`:**
   Buat file `.env` di root folder projek dan isi seluruh variabel `EXPO_PUBLIC_*` di atas.
3. **Jalankan Server Expo:**
   ```bash
   npx expo start -c
   ```
   - Tekan `w` untuk membuka di Web Browser, atau
   - Pindai QR Code menggunakan aplikasi **Expo Go** di perangkat fisik Android / iOS.

---

## 3. Staging & Production Deployment (EAS Hosting & Web Export)

Aplikasi Freshia mendukung kompilasi dan deployment lintas platform melalui **Expo Web Export** dan **EAS Hosting (`*.on.expo.app`)**:

1. **Ekspor Bundel Web Statis (`dist/`):**
   ```bash
   npx expo export -p web
   ```
2. **Deploy ke EAS Hosting:**
   ```bash
   npx eas-cli deploy
   ```
   - **Staging / Preview URL Aktif:** `https://c-callistajb-thig10-mwlvrw6zs1a4lfh1.on.expo.app`
3. **Otorisasi Domain Google OAuth di Firebase Console:**
   Setiap domain hasil deployment (`*.on.expo.app`) wajib didaftarkan pada **Firebase Console (`freshia-5`) $\rightarrow$ Authentication $\rightarrow$ Settings $\rightarrow$ Authorized domains** agar fitur *Sign in with Google* (`signInWithPopup`) tidak ditolak dengan `auth/unauthorized-domain`.
