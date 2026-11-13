# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

PENJELASAN RUNNING 2

# Freshia 📱

Aplikasi mobile berbasis [Expo](https://expo.dev) dan React Native (Expo Router) dengan direktori utama di `src/app`.

---

## 🚀 Persiapan Awal (Saat Pertama Kali Clone)

Jika Anda baru pertama kali mengunduh/clone proyek ini ke laptop baru, ikuti langkah berikut:

1. **Instal seluruh dependensi proyek**

   ```bash
   npm install
   ```

2. **Konfigurasi Environment Variables (`.env`)**
   Buat file bernama `.env` di folder utama proyek (sejajar dengan `package.json`), lalu isi dengan kredensial API berikut:

   ```env
   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=isi_cloud_name_anda
   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=isi_upload_preset_anda
   EXPO_PUBLIC_GEMINI_API_KEY=isi_gemini_api_key_anda
   EXPO_PUBLIC_ROBOFLOW_API_KEY=isi_roboflow_api_key_anda
   EXPO_PUBLIC_ROBOFLOW_MODEL_ID=isi_roboflow_model_id_anda
   ```

   _(Minta nilai kredensial `.env` yang aktif kepada pemilik/rekan tim proyek)._

3. **Jalankan aplikasi**
   ```bash
   npx expo start -c
   ```

---

## 🔄 Panduan Setiap Kali Melakukan `git pull` Baru

Setiap kali Anda menarik pembaruan terbaru dari repositori (`git pull`), biasakan menjalankan langkah berikut agar tidak terjadi error library atau cache lama:

1. **Tarik pembaruan kode terbaru**

   ```bash
   git pull origin main
   ```

   _(Sesuaikan `main` dengan nama branch yang digunakan)._

2. **Perbarui package jika ada penambahan library baru**

   ```bash
   npm install
   ```

3. **Jalankan ulang Expo dengan membersihkan cache (`-c`)**

   ```bash
   npx expo start -c
   ```

4. **Buka aplikasi di perangkat Anda:**
   - **Android / iOS (Expo Go):** Scan QR Code yang muncul di terminal menggunakan aplikasi **Expo Go** (Android) atau kamera bawaan (iOS).
   - **Web:** Tekan tombol `w` di terminal atau buka `http://localhost:8081`.

---

## 🛠️ Solusi Masalah Umum (Troubleshooting)

- **Error `Unable to resolve "<nama-package>"` (misalnya `expo-linear-gradient`):**
  Ada library baru yang belum terinstal di laptop Anda. Jalankan perintah:

  ```bash
  npx expo install <nama-package>
  npx expo start -c
  ```

- **Error `Request timed out` saat membuka di Expo Go (iOS / Android):**
  Biasanya terjadi karena perbedaan jaringan Wi-Fi atau terblokir Windows Firewall. Jalankan Expo menggunakan mode tunnel:

  ```bash
  npx expo start --tunnel
  ```

- **Perubahan `.env` tidak terbaca:**
  Hentikan server (`Ctrl + C`), lalu jalankan ulang dengan membersihkan cache:
  ```bash
  npx expo start -c
  ```
