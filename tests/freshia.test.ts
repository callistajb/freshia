import test from "node:test";
import assert from "node:assert";

import { parseGeminiResponse, formatRupiah } from "../src/utils/aiParser.ts";
import {
  validateEmail,
  validatePassword,
  validateDimensions,
  validateWeight,
} from "../src/utils/validation.ts";
import {
  calculateEstimatedVolume,
  calculateSalvageValue,
} from "../src/utils/pricingCalculator.ts";
import {
  calculateDashboardStats,
  type HistoryRecord,
} from "../src/utils/statsCalculator.ts";

console.log("\n==========================================");
console.log("  FRESHIA COMPREHENSIVE TEST SUITE (W11)  ");
console.log("==========================================\n");

// ----------------------------------------------------
// 1. TEST GROUP: AI Response Parser (FR-05 Traceability)
// ----------------------------------------------------
test("AI Parser: should parse valid clean JSON response", () => {
  const mockJson = JSON.stringify({
    freshnessPercentage: 88,
    salvageValue: "Rp 35.000",
    shelfLife: "5 hari",
    recipe: "Dapat dikonsumsi langsung atau dijadikan salad buah segar.",
  });

  const result = parseGeminiResponse(mockJson);
  assert.strictEqual(result.freshnessPercentage, 88);
  assert.strictEqual(result.salvageValue, "Rp 35.000");
  assert.strictEqual(result.shelfLife, "5 hari");
  assert.ok(result.recipe.includes("salad buah"));
});

test("AI Parser: should handle JSON wrapped in markdown fences (```json ... ```)", () => {
  const mockMarkdown = `\`\`\`json
{
  "freshnessPercentage": 45,
  "salvageValue": "Rp 12.000",
  "shelfLife": "1-2 hari",
  "recipe": "Olah menjadi selai apel atau banana bread zero-waste."
}
\`\`\``;

  const result = parseGeminiResponse(mockMarkdown);
  assert.strictEqual(result.freshnessPercentage, 45);
  assert.strictEqual(result.salvageValue, "Rp 12.000");
  assert.strictEqual(result.shelfLife, "1-2 hari");
});

test("AI Parser: should clamp freshness percentage between 0 and 100", () => {
  const overHundred = JSON.stringify({
    freshnessPercentage: 150,
    salvageValue: "Rp 20.000",
    shelfLife: "7 hari",
    recipe: "Segar",
  });
  const underZero = JSON.stringify({
    freshnessPercentage: -25,
    salvageValue: "Rp 0",
    shelfLife: "0 hari",
    recipe: "Kompos",
  });

  assert.strictEqual(parseGeminiResponse(overHundred).freshnessPercentage, 100);
  assert.strictEqual(parseGeminiResponse(underZero).freshnessPercentage, 0);
});

test("AI Parser: should throw informative error on malformed string", () => {
  assert.throws(() => {
    parseGeminiResponse("Bukan json sama sekali");
  }, /Gagal mem-parsing/);

  assert.throws(() => {
    parseGeminiResponse("");
  }, /Respons Gemini kosong/);
});

test("AI Parser: formatRupiah helper formats currency correctly", () => {
  const formatted = formatRupiah(25000);
  assert.ok(formatted.includes("25.000"));
});

// ----------------------------------------------------
// 2. TEST GROUP: Authentication & Input Validation (FR-01 Traceability)
// ----------------------------------------------------
test("Validation: validateEmail validates correct email structures", () => {
  assert.strictEqual(validateEmail("freshian@freshia.id"), true);
  assert.strictEqual(validateEmail("mahasiswa@student.umn.ac.id"), true);
  assert.strictEqual(validateEmail("invalid-email"), false);
  assert.strictEqual(validateEmail("test@"), false);
  assert.strictEqual(validateEmail(""), false);
});

test("Validation: validatePassword enforces 6 characters minimum", () => {
  assert.strictEqual(validatePassword("secret123").valid, true);
  assert.strictEqual(validatePassword("12345").valid, false);
  assert.strictEqual(validatePassword("").valid, false);
  assert.ok(validatePassword("short").message?.includes("minimal 6 karakter"));
});

test("Validation: validateDimensions verifies UMKM basket dimensions", () => {
  assert.strictEqual(validateDimensions(40, 30, 20), true);
  assert.strictEqual(validateDimensions(0, 30, 20), false);
  assert.strictEqual(validateDimensions(-10, 30, 20), false);
  assert.strictEqual(validateDimensions(500, 30, 20), false); // Terlalu besar
});

test("Validation: validateWeight verifies Household purchase weight", () => {
  assert.strictEqual(validateWeight(1.5), true);
  assert.strictEqual(validateWeight(0), false);
  assert.strictEqual(validateWeight(-2), false);
  assert.strictEqual(validateWeight(150), false); // Terlalu besar
});

// ----------------------------------------------------
// 3. TEST GROUP: Pricing & Salvage Value Logic (FR-02 Traceability)
// ----------------------------------------------------
test("Pricing: calculateEstimatedVolume converts cm3 to liters correctly", () => {
  // 40 x 30 x 20 = 24,000 cm3 = 24 liters
  const liters = calculateEstimatedVolume(40, 30, 20);
  assert.strictEqual(liters, 24);
  assert.strictEqual(calculateEstimatedVolume(0, 30, 20), 0);
});

test("Pricing: calculateSalvageValue applies proper discount ratio per freshness tier", () => {
  // Fresh buah (>70%) -> 100% salvage
  const freshValue = calculateSalvageValue(85, "Rumah Tangga", {
    weightKg: 2,
    basePricePerKg: 20000,
  });
  assert.strictEqual(freshValue, 40000); // 2 * 20000 * 1.0

  // Mulai layu (40-70%) -> 50% discount salvage
  const layingValue = calculateSalvageValue(50, "Rumah Tangga", {
    weightKg: 2,
    basePricePerKg: 20000,
  });
  assert.strictEqual(layingValue, 20000); // 2 * 20000 * 0.5

  // Hampir busuk (20-40%) -> 25% salvage
  const lowValue = calculateSalvageValue(30, "Rumah Tangga", {
    weightKg: 2,
    basePricePerKg: 20000,
  });
  assert.strictEqual(lowValue, 10000); // 2 * 20000 * 0.25

  // Busuk (<20%) -> 5% salvage (nilai pakan / kompos)
  const rottenValue = calculateSalvageValue(10, "Rumah Tangga", {
    weightKg: 2,
    basePricePerKg: 20000,
  });
  assert.strictEqual(rottenValue, 2000); // 2 * 20000 * 0.05
});

test("Pricing: calculateSalvageValue works for UMKM volume", () => {
  // UMKM 24 liter keranjang -> approx 10.8 kg buah
  const umkmSalvage = calculateSalvageValue(75, "UMKM", {
    volumeLiters: 24,
    basePricePerKg: 20000,
  });
  assert.strictEqual(umkmSalvage, 216000); // 24 * 0.45 * 20000 * 1.0
});

// ----------------------------------------------------
// 4. TEST GROUP: Dashboard & Statistics (FR-06 & FR-07 Traceability)
// ----------------------------------------------------
test("Stats: calculateDashboardStats computes counts and averages", () => {
  const mockHistory: HistoryRecord[] = [
    {
      id: "1",
      date: "2026-11-01",
      image: "file://1.jpg",
      result: {
        label: "Fresh Apple",
        analysis: { freshnessPercentage: 90 },
      },
    },
    {
      id: "2",
      date: "2026-11-02",
      image: "file://2.jpg",
      result: {
        label: "Rotten Banana",
        analysis: { freshnessPercentage: 20 },
      },
    },
    {
      id: "3",
      date: "2026-11-03",
      image: "file://3.jpg",
      result: {
        label: "Fresh Orange",
        analysis: { freshnessPercentage: 70 },
      },
    },
  ];

  const stats = calculateDashboardStats(mockHistory);
  assert.strictEqual(stats.total, 3);
  assert.strictEqual(stats.fresh, 2);
  assert.strictEqual(stats.rotten, 1);
  assert.strictEqual(stats.unknown, 0);
  assert.strictEqual(stats.averageFreshness, 60); // (90 + 20 + 70) / 3 = 60
});

test("Stats: calculateDashboardStats handles empty history gracefully", () => {
  const stats = calculateDashboardStats([]);
  assert.strictEqual(stats.total, 0);
  assert.strictEqual(stats.fresh, 0);
  assert.strictEqual(stats.rotten, 0);
  assert.strictEqual(stats.averageFreshness, 0);
});
