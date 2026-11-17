/**
 * Validasi alamat email
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validasi kata sandi (minimal 6 karakter)
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: "Kata sandi wajib diisi." };
  }
  if (password.length < 6) {
    return { valid: false, message: "Kata sandi minimal 6 karakter." };
  }
  return { valid: true };
}

/**
 * Validasi dimensi keranjang UMKM (P x L x T cm)
 */
export function validateDimensions(p: number, l: number, t: number): boolean {
  return p > 0 && p <= 300 && l > 0 && l <= 300 && t > 0 && t <= 200;
}

/**
 * Validasi estimasi berat belanja rumah tangga (kg)
 */
export function validateWeight(weightKg: number): boolean {
  return weightKg > 0 && weightKg <= 100;
}
