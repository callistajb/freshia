const test = require("node:test");
const assert = require("node:assert");

// Import utility functions (compiled or pure logic)
const {
  parseGeminiResponse,
  formatRupiah,
} = require("../src/utils/aiParser");
const {
  validateEmail,
  validatePassword,
  validateDimensions,
  validateWeight,
} = require("../src/utils/validation");
const {
  calculateEstimatedVolume,
  calculateSalvageValue,
} = require("../src/utils/pricingCalculator");
const {
  calculateDashboardStats,
} = require("../src/utils/statsCalculator");

console.log("=== RUNNING FRESHIA COMPREHENSIVE TEST SUITE ===");
