export interface GeminiFruitAnalysis {
  freshnessPercentage: number;
  salvageValue: string;
  shelfLife: string;
  recipe: string;
}

/**
 * Membersihkan dan mem-parsing teks respons dari Gemini AI menjadi object terstruktur.
 * Mampu menangani markdown fences, whitespace berlebih, atau field yang hilang.
 */
export function parseGeminiResponse(rawText: string): GeminiFruitAnalysis {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Respons Gemini kosong atau tidak valid.");
  }

  // Bersihkan format markdown ```json ... ``` atau ``` ... ```
  let cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Jika masih ada karakter pembuka/penutup JSON yang terpotong
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`Gagal mem-parsing format JSON Gemini: ${err.message}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Format JSON bukan merupakan objek valid.");
  }

  const rawFreshness = Number.parseFloat(String(parsed.freshnessPercentage ?? 0));
  const freshnessPercentage = Number.isNaN(rawFreshness)
    ? 0
    : Math.min(100, Math.max(0, Math.round(rawFreshness)));

  const salvageValue = String(parsed.salvageValue ?? "Rp0");
  const shelfLife = String(parsed.shelfLife ?? "1 hari");
  const recipe = String(parsed.recipe ?? "Dapat diolah menjadi selai, jus, atau kompos.");

  return {
    freshnessPercentage,
    salvageValue,
    shelfLife,
    recipe,
  };
}

/**
 * Format angka atau string ke mata uang Rupiah
 */
export function formatRupiah(val: number | string): string {
  const num = typeof val === "number" ? val : Number.parseInt(String(val).replace(/\D/g, ""), 10) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}
