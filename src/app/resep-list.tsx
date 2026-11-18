import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebaseConfig";

export interface RecipeDetailItem {
  id: string;
  title: string;
  subtitle: string;
  fruitName: string;
  prepTime: string;
  difficulty: string;
  calories: string;
  ingredients: string[];
  steps: string[];
  imageUri?: string;
}

const GEMINI_MODELS: string[] = [
  process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
].filter((name, index, list) => Boolean(name) && list.indexOf(name) === index);

// Daftar katalog buah lengkap agar halaman resep selalu menampilkan semua resep meskipun user belum pernah scan
const DEFAULT_FRUIT_CATALOG: string[] = [
  "Pisang",
  "Apel",
  "Mangga",
  "Jeruk",
  "Alpukat",
  "Stroberi",
  "Semangka",
  "Pepaya",
  "Anggur",
  "Melon",
  "Nanas",
  "Buah Naga",
];

// Generator resep katalog lengkap & fallback otomatis untuk setiap jenis buah
const buildFallbackRecipes = (
  fruitName: string,
  kategori: "makanan" | "minuman",
  imageUri?: string,
): RecipeDetailItem[] => {
  const cleanFruit = fruitName.trim() || "Buah Segar";
  const slug = cleanFruit.toLowerCase().replace(/\s+/g, "-");

  if (kategori === "minuman") {
    return [
      {
        id: `catalog-minuman-${slug}-1`,
        title: `Smoothie Bowl & Susu ${cleanFruit}`,
        subtitle: `Minuman kental bernutrisi tinggi untuk mengolah ${cleanFruit} matang agar tidak terbuang.`,
        fruitName: cleanFruit,
        prepTime: "10 Menit",
        difficulty: "Mudah",
        calories: "165 kkal",
        ingredients: [
          `200 gr daging buah ${cleanFruit}, potong kecil`,
          "150 ml susu cair rendah lemak atau yogurt tawar",
          "1 sdm madu murni",
          "Es batu secukupnya",
        ],
        steps: [
          `Kupas dan bersihkan buah ${cleanFruit}, lalu potong dadu agar mudah diblender.`,
          "Masukkan potongan buah, susu cair, madu, dan es batu ke dalam blender.",
          "Haluskan selama 45 detik hingga tekstur lembut dan creamy, lalu sajikan segera.",
        ],
        imageUri,
      },
      {
        id: `catalog-minuman-${slug}-2`,
        title: `Es Jus ${cleanFruit} Madu Lemon`,
        subtitle: `Perpaduan segar ${cleanFruit} dengan perasan lemon/jeruk nipis yang kaya antioksidan.`,
        fruitName: cleanFruit,
        prepTime: "10 Menit",
        difficulty: "Mudah",
        calories: "120 kkal",
        ingredients: [
          `250 gr daging buah ${cleanFruit}`,
          "200 ml air matang dingin",
          "1 sdm perasan lemon atau jeruk nipis",
          "1-2 sdm madu atau gula aren cair",
        ],
        steps: [
          `Haluskan daging buah ${cleanFruit} bersama air matang menggunakan blender.`,
          "Saring bila ingin tekstur lebih jernih, lalu tambahkan madu dan perasan jeruk nipis.",
          "Aduk rata dan sajikan dingin dengan tambahan es batu.",
        ],
        imageUri,
      },
      {
        id: `catalog-minuman-${slug}-3`,
        title: `Infused Water ${cleanFruit} Daun Mint`,
        subtitle: `Minuman detoks ringan tanpa pemanis tambahan untuk kesegaran harian.`,
        fruitName: cleanFruit,
        prepTime: "5 Menit",
        difficulty: "Mudah",
        calories: "35 kkal",
        ingredients: [
          `100 gr irisan tipis buah ${cleanFruit}`,
          "500 ml air mineral dingin",
          "5 lembar daun mint segar",
        ],
        steps: [
          `Iris tipis buah ${cleanFruit} dan masukkan ke dalam botol atau pitcher kaca.`,
          "Tambahkan daun mint dan tuang air mineral dingin.",
          "Simpan di kulkas minimal 1 jam sebelum diminum agar sari buah meresap.",
        ],
        imageUri,
      },
    ];
  }

  return [
    {
      id: `catalog-makanan-${slug}-1`,
      title: `Selai Homemade ${cleanFruit} Zero-Waste`,
      subtitle: `Olesan roti alami tanpa pengawet untuk memperpanjang masa simpan ${cleanFruit} yang mulai lembek.`,
      fruitName: cleanFruit,
      prepTime: "25 Menit",
      difficulty: "Mudah",
      calories: "140 kkal",
      ingredients: [
        `300 gr daging buah ${cleanFruit}, cincang halus`,
        "3 sdm gula pasir atau gula aren",
        "1 sdm air perasan lemon atau jeruk nipis",
        "50 ml air matang",
      ],
      steps: [
        `Masak potongan ${cleanFruit}, gula, dan air di atas api kecil sambil diaduk perlahan.`,
        "Lumatkan daging buah saat mulai melunak hingga mengental seperti selai.",
        "Tambahkan air perasan lemon, aduk 2 menit lalu simpan dalam stoples kaca bersih.",
      ],
      imageUri,
    },
    {
      id: `catalog-makanan-${slug}-2`,
      title: `Overnight Oats & Topping ${cleanFruit}`,
      subtitle: `Menu sarapan praktis kaya serat dengan potongan buah ${cleanFruit}.`,
      fruitName: cleanFruit,
      prepTime: "10 Menit",
      difficulty: "Mudah",
      calories: "240 kkal",
      ingredients: [
        `150 gr daging buah ${cleanFruit}, potong dadu`,
        "5 sdm rolled oats",
        "150 ml susu cair atau susu nabati",
        "1 sdt chia seed dan 1 sdm madu",
      ],
      steps: [
        "Campurkan oats, susu cair, chia seed, dan madu di dalam wadah tertutup.",
        `Tambahkan setengah bagian potongan ${cleanFruit}, aduk rata dan simpan di kulkas semalaman.`,
        `Sajikan keesokan paginya dengan sisa potongan ${cleanFruit} di atasnya.`,
      ],
      imageUri,
    },
    {
      id: `catalog-makanan-${slug}-3`,
      title: `Salad Buah ${cleanFruit} Saus Yogurt Madu`,
      subtitle: `Camilan sehat segar berbahan ${cleanFruit} dengan dressing yogurt madu yang ringan.`,
      fruitName: cleanFruit,
      prepTime: "15 Menit",
      difficulty: "Mudah",
      calories: "175 kkal",
      ingredients: [
        `250 gr daging buah ${cleanFruit}, potong sesuai selera`,
        "100 gr yogurt plain kental",
        "1 sdm madu murni",
        "Keju parut secukupnya untuk taburan",
      ],
      steps: [
        `Tata potongan buah ${cleanFruit} dingin di dalam mangkuk saji.`,
        "Aduk rata yogurt plain bersama madu hingga menjadi saus lembut.",
        "Siram saus di atas buah dan beri taburan keju parut sebelum disajikan.",
      ],
      imageUri,
    },
  ];
};

export interface FruitOption {
  name: string;
  imageUri?: string;
  freshness?: number;
  isScanned: boolean;
}

export default function ResepListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kategori?: string;
    fruit?: string;
  }>();

  const kategori: "makanan" | "minuman" =
    params.kategori === "minuman" ? "minuman" : "makanan";

  const [scannedFruits, setScannedFruits] = useState<FruitOption[]>([]);
  // Multi-select buah yang dimiliki user (kosong = tampilkan Semua Buah)
  const [selectedFruits, setSelectedFruits] = useState<string[]>(
    params.fruit ? [params.fruit] : [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [aiGeneratedByFruit, setAiGeneratedByFruit] = useState<
    Record<string, RecipeDetailItem[]>
  >({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  // 1. Muat daftar buah yang pernah di-scan user lalu gabungkan dengan katalog buah lengkap
  const loadFruitsAndHistory = useCallback(async () => {
    setIsLoadingData(true);
    const currentUid = auth.currentUser?.uid;
    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      const parsed = stored ? JSON.parse(stored) : [];
      const fruitMap = new Map<string, FruitOption>();

      if (Array.isArray(parsed)) {
        parsed.forEach((entry: any) => {
          if (currentUid && entry.userId && entry.userId !== currentUid) return;
          const pct = Number(entry.result?.analysis?.freshnessPercentage ?? 0);
          const label = String(entry.result?.label || "").trim();

          if (
            !label ||
            label.toLowerCase() === "buah" ||
            label.toLowerCase() === "bukan buah" ||
            pct === 0
          ) {
            return;
          }

          const key = label.toLowerCase();
          if (!fruitMap.has(key)) {
            fruitMap.set(key, {
              name: label,
              imageUri: entry.image,
              freshness: pct,
              isScanned: true,
            });
          }
        });
      }

      setScannedFruits(Array.from(fruitMap.values()));

      if (params.fruit) {
        setSelectedFruits([params.fruit]);
      }
    } catch (e) {
      console.warn("Gagal membaca riwayat buah untuk resep:", e);
      setScannedFruits([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [params.fruit]);

  useFocusEffect(
    useCallback(() => {
      loadFruitsAndHistory();
    }, [loadFruitsAndHistory]),
  );

  // Gabungkan buah hasil scan user (di urutan paling depan) dengan katalog semua buah
  const allAvailableFruits: FruitOption[] = useMemo(() => {
    const map = new Map<string, FruitOption>();

    // Masukkan buah hasil scan dulu agar mudah terlihat
    scannedFruits.forEach((f) => {
      map.set(f.name.toLowerCase(), f);
    });

    // Tambahkan seluruh buah dari katalog default
    DEFAULT_FRUIT_CATALOG.forEach((fruitName) => {
      const key = fruitName.toLowerCase();
      // Cek apakah sudah ada versi buah yang mirip (misal "Apel Merah" vs "Apel")
      if (!map.has(key)) {
        map.set(key, {
          name: fruitName,
          isScanned: false,
        });
      }
    });

    return Array.from(map.values());
  }, [scannedFruits]);

  // Toggle pilih/batal pilih buah yang dimiliki user (Multi-Select)
  const handleToggleFruitSelection = (fruitName: string) => {
    setSelectedFruits((prev) => {
      const exists = prev.some(
        (f) => f.toLowerCase() === fruitName.toLowerCase(),
      );
      if (exists) {
        return prev.filter((f) => f.toLowerCase() !== fruitName.toLowerCase());
      }
      return [...prev, fruitName];
    });
  };

  // Pilih hanya semua buah yang pernah di-scan user
  const handleSelectMyScannedFruits = () => {
    if (scannedFruits.length === 0) return;
    const scannedNames = scannedFruits.map((f) => f.name);
    const isAlreadySame =
      selectedFruits.length === scannedNames.length &&
      scannedNames.every((n) =>
        selectedFruits.some((s) => s.toLowerCase() === n.toLowerCase()),
      );
    setSelectedFruits(isAlreadySame ? [] : scannedNames);
  };

  // 2. Fungsi Generate Resep Tambahan lewat Gemini AI untuk buah yang dipilih
  const generateRecipesWithGemini = useCallback(
    async (fruitTarget: string) => {
      if (!fruitTarget) return;

      const matchedStock = allAvailableFruits.find(
        (f) => f.name.toLowerCase() === fruitTarget.toLowerCase(),
      );

      const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!GEMINI_API_KEY) return;

      setIsLoadingAI(true);

      const kategoriLabel =
        kategori === "makanan"
          ? "Olahan Makanan (camilan, kue, sarapan, atau hidangan penutup)"
          : "Olahan Minuman (jus, smoothie, infused water, atau mocktail sehat)";

      const freshnessContext = matchedStock?.freshness
        ? `Tingkat kesegaran buah saat di-scan adalah ${matchedStock.freshness}%. Sesuaikan teknik pengolahannya dengan kondisi kesegaran tersebut.`
        : "";

      const prompt = `Buatkan 3 ide resep ${kategoriLabel} berbahan utama buah "${fruitTarget}" dalam Bahasa Indonesia yang praktis, lezat, dan mendukung konsep zero-waste.
${freshnessContext}
Kembalikan respons MURNI dalam format JSON array berisi 3 objek dengan struktur berikut:
[
  {
    "title": "Nama Resep",
    "subtitle": "Deskripsi singkat 1 kalimat menarik",
    "prepTime": "contoh: 15 Menit",
    "difficulty": "Mudah / Sedang",
    "calories": "contoh: 185 kkal",
    "ingredients": ["bahan 1 dengan takaran", "bahan 2 dengan takaran"],
    "steps": ["langkah 1", "langkah 2", "langkah 3"]
  }
]`;

      for (const model of GEMINI_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  responseMimeType: "application/json",
                },
              }),
            },
          );

          const data = await response.json();
          if (!response.ok) continue;

          const parts = data?.candidates?.[0]?.content?.parts;
          const textResponse = Array.isArray(parts)
            ? parts
                .filter(
                  (part: any) => typeof part.text === "string" && !part.thought,
                )
                .map((part: any) => part.text)
                .join("")
            : "";

          if (textResponse) {
            const cleanJson = textResponse
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            const parsedList = JSON.parse(cleanJson);
            if (Array.isArray(parsedList) && parsedList.length > 0) {
              const formatted: RecipeDetailItem[] = parsedList.map(
                (item: any, idx: number) => ({
                  id: `ai-${kategori}-${fruitTarget}-${idx}-${Date.now()}`,
                  title: String(item.title || `Olahan ${fruitTarget}`),
                  subtitle: String(
                    item.subtitle || "Resep sehat zero-waste dari Freshia",
                  ),
                  fruitName: fruitTarget,
                  prepTime: String(item.prepTime || "15 Menit"),
                  difficulty: String(item.difficulty || "Mudah"),
                  calories: String(item.calories || "180 kkal"),
                  ingredients: Array.isArray(item.ingredients)
                    ? item.ingredients.map(String)
                    : [],
                  steps: Array.isArray(item.steps)
                    ? item.steps.map(String)
                    : [],
                  imageUri: matchedStock?.imageUri,
                }),
              );
              setAiGeneratedByFruit((prev) => ({
                ...prev,
                [fruitTarget.toLowerCase()]: formatted,
              }));
              break;
            }
          }
        } catch (err: any) {
          console.warn(`Kesalahan jaringan pada ${model}:`, err?.message);
        }
      }
      setIsLoadingAI(false);
    },
    [kategori, allAvailableFruits],
  );

  // Jika user memilih tepat 1 buah spesifik dan belum pernah di-generate AI, coba perkaya dengan Gemini AI
  useEffect(() => {
    if (selectedFruits.length === 1) {
      const target = selectedFruits[0];
      if (!aiGeneratedByFruit[target.toLowerCase()]) {
        generateRecipesWithGemini(target);
      }
    }
  }, [selectedFruits, aiGeneratedByFruit, generateRecipesWithGemini]);

  // Susun daftar semua resep yang ditampilkan berdasarkan filter buah yang dipilih user
  const displayedRecipes: RecipeDetailItem[] = useMemo(() => {
    const activeFruitList =
      selectedFruits.length > 0
        ? allAvailableFruits.filter((f) =>
            selectedFruits.some(
              (sel) => sel.toLowerCase() === f.name.toLowerCase(),
            ),
          )
        : allAvailableFruits;

    const combined: RecipeDetailItem[] = [];
    activeFruitList.forEach((fruitObj) => {
      const key = fruitObj.name.toLowerCase();
      const aiList = aiGeneratedByFruit[key];
      if (aiList && aiList.length > 0) {
        combined.push(...aiList);
      } else {
        combined.push(
          ...buildFallbackRecipes(fruitObj.name, kategori, fruitObj.imageUri),
        );
      }
    });

    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return combined;
    return combined.filter(
      (r) =>
        r.title.toLowerCase().includes(kw) ||
        r.subtitle.toLowerCase().includes(kw) ||
        r.fruitName.toLowerCase().includes(kw),
    );
  }, [
    selectedFruits,
    allAvailableFruits,
    aiGeneratedByFruit,
    kategori,
    searchQuery,
  ]);

  const openRecipeDetail = (item: RecipeDetailItem) => {
    router.push({
      pathname: "/resep-detail",
      params: {
        recipeData: JSON.stringify(item),
        kategori,
      },
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header Merah */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {kategori === "makanan"
            ? "Olahan Makanan Buah"
            : "Olahan Minuman Buah"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* Body Putih Melengkung */}
      <View style={styles.whiteBody}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isLoadingData ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#C8201B" />
              <Text style={styles.loadingTitle}>Memuat Katalog Resep...</Text>
            </View>
          ) : (
            <>
              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color="#9E9E9E"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama resep atau nama buah..."
                  placeholderTextColor="#9E9E9E"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9E9E9E" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Panel Selection Buah yang Dimiliki User */}
              <View style={styles.selectionCard}>
                <View style={styles.selectionHeaderRow}>
                  <View style={styles.selectionTitleRow}>
                    <MaterialCommunityIcons
                      name="fruit-cherries"
                      size={18}
                      color="#9A1B17"
                    />
                    <Text style={styles.selectionTitle}>
                      Pilih Buah yang Kamu Punya:
                    </Text>
                  </View>

                  {selectedFruits.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSelectedFruits([])}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.resetFilterText}>Reset Filter</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.selectionSubtitle}>
                  Ketuk satu atau beberapa buah di bawah untuk memfilter resep
                  sesuai stok buahmu
                </Text>

                {/* Tombol Cepat: Semua Buah & Buah Hasil Scan */}
                <View style={styles.quickFilterRow}>
                  <TouchableOpacity
                    style={[
                      styles.quickFilterBtn,
                      selectedFruits.length === 0 &&
                        styles.quickFilterBtnActive,
                    ]}
                    onPress={() => setSelectedFruits([])}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        selectedFruits.length === 0
                          ? "CheckmarkCircle" in Ionicons.glyphMap
                            ? "checkmark-circle"
                            : "checkmark-circle"
                          : "apps-outline"
                      }
                      size={15}
                      color={selectedFruits.length === 0 ? "#FFFFFF" : "#9A1B17"}
                    />
                    <Text
                      style={[
                        styles.quickFilterText,
                        selectedFruits.length === 0 &&
                          styles.quickFilterTextActive,
                      ]}
                    >
                      Semua Buah ({allAvailableFruits.length})
                    </Text>
                  </TouchableOpacity>

                  {scannedFruits.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.quickFilterBtn,
                        selectedFruits.length === scannedFruits.length &&
                          scannedFruits.every((sf) =>
                            selectedFruits.some(
                              (sel) =>
                                sel.toLowerCase() === sf.name.toLowerCase(),
                            ),
                          ) &&
                          styles.quickFilterBtnActive,
                      ]}
                      onPress={handleSelectMyScannedFruits}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="scan-circle-outline"
                        size={16}
                        color={
                          selectedFruits.length === scannedFruits.length &&
                          scannedFruits.every((sf) =>
                            selectedFruits.some(
                              (sel) =>
                                sel.toLowerCase() === sf.name.toLowerCase(),
                            ),
                          )
                            ? "#FFFFFF"
                            : "#9A1B17"
                        }
                      />
                      <Text
                        style={[
                          styles.quickFilterText,
                          selectedFruits.length === scannedFruits.length &&
                            scannedFruits.every((sf) =>
                              selectedFruits.some(
                                (sel) =>
                                  sel.toLowerCase() === sf.name.toLowerCase(),
                              ),
                            ) &&
                            styles.quickFilterTextActive,
                        ]}
                      >
                        Buah Hasil Scan ({scannedFruits.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Multi-select Chips Seluruh Buah */}
                <View style={styles.fruitChipsWrap}>
                  {allAvailableFruits.map((fruit) => {
                    const isSelected = selectedFruits.some(
                      (s) => s.toLowerCase() === fruit.name.toLowerCase(),
                    );
                    return (
                      <TouchableOpacity
                        key={fruit.name}
                        style={[
                          styles.chip,
                          fruit.isScanned && styles.chipScanned,
                          isSelected && styles.chipActive,
                        ]}
                        onPress={() => handleToggleFruitSelection(fruit.name)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={
                            isSelected
                              ? "checkbox"
                              : fruit.isScanned
                                ? "scan-outline"
                                : "add-circle-outline"
                          }
                          size={14}
                          color={isSelected ? "#9A1B17" : "#7A6A6A"}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}
                        >
                          {fruit.name}
                          {fruit.freshness ? ` (${fruit.freshness}%)` : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Ringkasan Jumlah Resep yang Ditampilkan */}
              <View style={styles.resultHeaderRow}>
                <Text style={styles.resultCountText}>
                  Menampilkan{" "}
                  <Text style={{ fontWeight: "700", color: "#9A1B17" }}>
                    {displayedRecipes.length} resep
                  </Text>{" "}
                  {selectedFruits.length > 0
                    ? `untuk: ${selectedFruits.join(", ")}`
                    : "dari semua jenis buah"}
                </Text>

                {isLoadingAI && (
                  <View style={styles.aiInlineBadge}>
                    <ActivityIndicator size="small" color="#C8201B" />
                    <Text style={styles.aiInlineText}>Meracik AI...</Text>
                  </View>
                )}
              </View>

              {/* Daftar Kartu Resep */}
              {displayedRecipes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialCommunityIcons
                    name="food-apple-outline"
                    size={48}
                    color="#C8201B"
                  />
                  <Text style={styles.emptyTitle}>Resep Tidak Ditemukan</Text>
                  <Text style={styles.emptySubtitle}>
                    Tidak ada resep yang cocok dengan kata kunci pencarianmu.
                    Coba hapus kata kunci atau pilih buah lainnya.
                  </Text>
                  <TouchableOpacity
                    style={styles.scanNowBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSearchQuery("");
                      setSelectedFruits([]);
                    }}
                  >
                    <Ionicons name="refresh" size={18} color="#FFFFFF" />
                    <Text style={styles.scanNowText}>
                      Tampilkan Semua Resep
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                displayedRecipes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recipeCard}
                    activeOpacity={0.85}
                    onPress={() => openRecipeDetail(item)}
                  >
                    <View style={styles.recipeThumbBox}>
                      {item.imageUri && !brokenThumbs[item.id] ? (
                        <Image
                          source={{ uri: item.imageUri }}
                          style={styles.recipeThumbImage}
                          resizeMode="cover"
                          onError={() =>
                            setBrokenThumbs((prev) => ({
                              ...prev,
                              [item.id]: true,
                            }))
                          }
                        />
                      ) : (
                        <Image
                          source={require("../../assets/images/apel makan.png")}
                          style={styles.recipeThumbFallback}
                          resizeMode="contain"
                        />
                      )}
                    </View>

                    <View style={styles.recipeInfo}>
                      <View style={styles.badgeRow}>
                        <View style={styles.fruitTag}>
                          <Text style={styles.fruitTagText}>
                            {item.fruitName}
                          </Text>
                        </View>
                        <View style={styles.timeTag}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color="#666666"
                          />
                          <Text style={styles.timeTagText}>
                            {item.prepTime}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.recipeTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.recipeSubtitle} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9A1B17"
                    />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#C8201B",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#C8201B",
    paddingTop: Platform.OS === "ios" ? 56 : 42,
    paddingBottom: 24,
    paddingHorizontal: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18.5,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSpacer: {
    width: 38,
  },
  whiteBody: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 22,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8E2E2",
    paddingVertical: 36,
    paddingHorizontal: 22,
    alignItems: "center",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9A1B17",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: "#666666",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  scanNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#C8201B",
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  scanNowText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#9A1B17",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#1C1C1E",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  selectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0E2E2",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  selectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  selectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#8E1612",
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C8201B",
    textDecorationLine: "underline",
  },
  selectionSubtitle: {
    fontSize: 11.5,
    color: "#666666",
    marginBottom: 10,
  },
  quickFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  quickFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FCE8E8",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F4C2C2",
  },
  quickFilterBtnActive: {
    backgroundColor: "#C8201B",
    borderColor: "#C8201B",
  },
  quickFilterText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#9A1B17",
  },
  quickFilterTextActive: {
    color: "#FFFFFF",
  },
  fruitChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E2DADA",
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipScanned: {
    borderColor: "#E5A5A3",
    backgroundColor: "#FFF9F9",
  },
  chipActive: {
    backgroundColor: "#FCE8E8",
    borderColor: "#9A1B17",
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#555555",
  },
  chipTextActive: {
    color: "#9A1B17",
    fontWeight: "700",
  },
  resultHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  resultCountText: {
    fontSize: 12.5,
    color: "#555555",
    flex: 1,
  },
  aiInlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiInlineText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#C8201B",
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0E2E2",
    paddingVertical: 38,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 6,
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9A1B17",
    marginTop: 14,
    marginBottom: 4,
  },
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2E2",
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
  },
  recipeThumbBox: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#FCE8E8",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 12,
  },
  recipeThumbImage: {
    width: 72,
    height: 72,
  },
  recipeThumbFallback: {
    width: 58,
    height: 58,
  },
  recipeInfo: {
    flex: 1,
    paddingRight: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  fruitTag: {
    backgroundColor: "#FCE8E8",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  fruitTagText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#9A1B17",
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timeTagText: {
    fontSize: 11,
    color: "#666666",
  },
  recipeTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 3,
  },
  recipeSubtitle: {
    fontSize: 11.5,
    color: "#555555",
    lineHeight: 16,
  },
});
