/**
 * Menghitung estimasi volume keranjang dalam liter
 */
export function calculateEstimatedVolume(panjangCm: number, lebarCm: number, tinggiCm: number): number {
  if (panjangCm <= 0 || lebarCm <= 0 || tinggiCm <= 0) return 0;
  // cm3 to liters (1 liter = 1000 cm3)
  return Math.round((panjangCm * lebarCm * tinggiCm) / 1000);
}

/**
 * Menghitung salvage value berbasis kesegaran dan kuantitas
 */
export function calculateSalvageValue(
  freshnessPercentage: number,
  mode: "UMKM" | "Rumah Tangga",
  params: {
    weightKg?: number;
    volumeLiters?: number;
    basePricePerKg?: number;
  }
): number {
  const basePrice = params.basePricePerKg || 25000; // Standar rata-rata harga buah per kg di IDR
  const freshness = Math.max(0, Math.min(100, freshnessPercentage));

  let estimatedKg = 1;
  if (mode === "UMKM") {
    // Estimasi berat buah per liter keranjang (densitas buah ~0.45 kg/liter keranjang)
    const liters = params.volumeLiters || 24;
    estimatedKg = liters * 0.45;
  } else {
    estimatedKg = params.weightKg || 1;
  }

  // Jika kesegaran > 70%: salvage value penuh
  // Jika 40-70%: diskon salvage 50% (layak jus/olahan grade B)
  // Jika 20-40%: diskon salvage 25% (layak olahan selai/keripik)
  // Jika < 20%: Rp0 (sudah busuk / kompos)
  let ratio = 0;
  if (freshness >= 70) {
    ratio = 1.0;
  } else if (freshness >= 40) {
    ratio = 0.5;
  } else if (freshness >= 20) {
    ratio = 0.25;
  } else {
    ratio = 0.05; // Nilai kompos / pakan ternak
  }

  return Math.round(estimatedKg * basePrice * ratio);
}
