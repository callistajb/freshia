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
  "gemini-2.5-flash",
].filter((name, index, list) => list.indexOf(name) === index);

// Resep cadangan otomatis jika server Gemini sedang 503 (sibuk) / limit
const buildFallbackRecipes = (
  fruitName: string,
  kategori: "makanan" | "minuman",
  imageUri?: string,
): RecipeDetailItem[] => {
  const now = Date.now();
  if (kategori === "minuman") {
    return [
      {
        id: `fallback-minuman-${fruitName}-1-${now}`,
        title: `Smoothie Segar ${fruitName}`,
        subtitle: `Minuman kental bernutrisi tinggi untuk mengolah ${fruitName} matang agar tidak terbuang.`,
        fruitName,
        prepTime: "10 Menit",
        difficulty: "Mudah",
        calories: "165 kkal",
        ingredients: [
          `200 gr daging buah ${fruitName}, potong kecil`,
          "150 ml susu cair rendah lemak atau yogurt tawar",
          "1 sdm madu murni",
          "Es batu secukupnya",
        ],
        steps: [
          `Kupas dan bersihkan buah ${fruitName}, lalu potong dadu agar mudah diblender.`,
          "Masukkan potongan buah, susu cair, madu, dan es batu ke dalam blender.",
          "Haluskan selama 45 detik hingga tekstur lembut dan creamy, lalu sajikan segera.",
        ],
        imageUri,
      },
      {
        id: `fallback-minuman-${fruitName}-2-${now}`,
        title: `Es Jus ${fruitName} Madu Jeruk Nipis`,
        subtitle: `Perpaduan segar ${fruitName} dengan perasan jeruk nipis yang kaya antioksidan.`,
        fruitName,
        prepTime: "10 Menit",
        difficulty: "Mudah",
        calories: "120 kkal",
        ingredients: [
          `250 gr daging buah ${fruitName}`,
          "200 ml air matang dingin",
          "1 sdm perasan jeruk nipis",
          "1-2 sdm madu atau gula aren cair",
        ],
        steps: [
          `Haluskan daging buah ${fruitName} bersama air matang menggunakan blender.`,
          "Saring bila ingin tekstur lebih jernih, lalu tambahkan madu dan perasan jeruk nipis.",
          "Aduk rata dan sajikan dingin dengan tambahan es batu.",
        ],
        imageUri,
      },
      {
        id: `fallback-minuman-${fruitName}-3-${now}`,
        title: `Infused Water ${fruitName} Mint`,
        subtitle: `Minuman detoks ringan tanpa pemanis tambahan untuk kesegaran harian.`,
        fruitName,
        prepTime: "5 Menit",
        difficulty: "Mudah",
        calories: "25 kkal",
        ingredients: [
          `100 gr irisan tipis buah ${fruitName}`,
          "500 ml air mineral dingin",
          "5 lembar daun mint segar",
        ],
        steps: [
          `Iris tipis buah ${fruitName} dan masukkan ke dalam botol atau pitcher kaca.`,
          "Tambahkan daun mint dan tuang air mineral dingin.",
          "Simpan di kulkas minimal 1 jam sebelum diminum agar sari buah meresap.",
        ],
        imageUri,
      },
    ];
  }

  return [
    {
      id: `fallback-makanan-${fruitName}-1-${now}`,
      title: `Selai Homemade ${fruitName}`,
      subtitle: `Olesan roti alami tanpa pengawet untuk memperpanjang masa simpan ${fruitName}.`,
      fruitName,
      prepTime: "25 Menit",
      difficulty: "Mudah",
      calories: "140 kkal",
      ingredients: [
        `300 gr daging buah ${fruitName}, cincang halus`,
        "3 sdm gula pasir atau gula aren",
        "1 sdm air perasan lemon atau jeruk nipis",
        "50 ml air",
      ],
      steps: [
        `Masak potongan ${fruitName}, gula, dan air di atas api kecil sambil diaduk perlahan.`,
        "Lumatkan daging buah saat mulai melunak hingga mengental.",
        "Tambahkan air perasan lemon, aduk 2 menit lalu simpan dalam stoples kaca bersih.",
      ],
      imageUri,
    },
    {
      id: `fallback-makanan-${fruitName}-2-${now}`,
      title: `Overnight Oats & Topping ${fruitName}`,
      subtitle: `Menu sarapan praktis kaya serat dengan potongan segar ${fruitName}.`,
      fruitName,
      prepTime: "10 Menit",
      difficulty: "Mudah",
      calories: "240 kkal",
      ingredients: [
        `150 gr daging buah ${fruitName}, potong dadu`,
        "5 sdm rolled oats",
        "150 ml susu cair atau susu nabati",
        "1 sdt chia seed dan 1 sdm madu",
      ],
      steps: [
        "Campurkan oats, susu cair, chia seed, dan madu di dalam wadah tertutup.",
        `Tambahkan setengah bagian potongan ${fruitName}, aduk rata dan simpan di kulkas semalaman.`,
        `Sajikan keesokan paginya dengan sisa potongan ${fruitName} di atasnya.`,
      ],
      imageUri,
    },
    {
      id: `fallback-makanan-${fruitName}-3-${now}`,
      title: `Salad Buah ${fruitName} Saus Yogurt`,
      subtitle: `Camilan sehat segar dengan dressing yogurt madu yang ringan.`,
      fruitName,
      prepTime: "15 Menit",
      difficulty: "Mudah",
      calories: "175 kkal",
      ingredients: [
        `250 gr daging buah ${fruitName}, potong sesuai selera`,
        "100 gr yogurt plain kental",
        "1 sdm madu",
        "Keju parut secukupnya untuk taburan",
      ],
      steps: [
        `Tata potongan buah ${fruitName} dingin di dalam mangkuk saji.`,
        "Aduk rata yogurt plain bersama madu hingga menjadi saus lembut.",
        "Siram saus di atas buah dan beri taburan keju parut sebelum disajikan.",
      ],
      imageUri,
    },
  ];
};

export default function ResepListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kategori?: string;
    fruit?: string;
  }>();

  const kategori: "makanan" | "minuman" =
    params.kategori === "minuman" ? "minuman" : "makanan";

  const [scannedFruits, setScannedFruits] = useState<
    { name: string; imageUri?: string; freshness?: number }[]
  >([]);
  const [selectedFruit, setSelectedFruit] = useState<string>(
    params.fruit || "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeDetailItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  // 1. Ambil HANYA buah yang beneran pernah di-scan user dari AsyncStorage
  const loadScannedFruits = useCallback(async () => {
    setIsLoadingData(true);
    const currentUid = auth.currentUser?.uid;
    try {
      const stored = await AsyncStorage.getItem("@freshia_history");
      if (!stored) {
        setScannedFruits([]);
        setIsLoadingData(false);
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setScannedFruits([]);
        setIsLoadingData(false);
        return;
      }

      const fruitMap = new Map<
        string,
        { name: string; imageUri?: string; freshness?: number }
      >();

      parsed.forEach((entry: any) => {
        if (currentUid && entry.userId && entry.userId !== currentUid) return;
        const pct = Number(entry.result?.analysis?.freshnessPercentage ?? 0);
        const label = String(entry.result?.label || "").trim();

        // Filter objek bukan buah atau hasil scan error 0%
        if (
          !label ||
          label.toLowerCase() === "buah" ||
          label.toLowerCase() === "bukan buah" ||
          pct === 0
        ) {
          return;
        }

        if (!fruitMap.has(label.toLowerCase())) {
          fruitMap.set(label.toLowerCase(), {
            name: label,
            imageUri: entry.image,
            freshness: pct,
          });
        }
      });

      const list = Array.from(fruitMap.values());
      setScannedFruits(list);

      if (params.fruit) {
        setSelectedFruit(params.fruit);
      } else if (list.length > 0) {
        setSelectedFruit((prev) =>
          prev && list.some((f) => f.name.toLowerCase() === prev.toLowerCase())
            ? prev
            : list[0].name,
        );
      } else {
        setSelectedFruit("");
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
      loadScannedFruits();
    }, [loadScannedFruits]),
  );

  // 2. Generate resep lewat Gemini AI dengan fallback otomatis jika server sibuk (503)
  const generateRecipesWithGemini = useCallback(
    async (fruitTarget: string) => {
      if (!fruitTarget) {
        setRecipes([]);
        return;
      }

      const matchedStock = scannedFruits.find(
        (f) => f.name.toLowerCase() === fruitTarget.toLowerCase(),
      );

      const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        setRecipes(
          buildFallbackRecipes(fruitTarget, kategori, matchedStock?.imageUri),
        );
        setAiError(null);
        return;
      }

      setIsLoadingAI(true);
      setAiError(null);

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

      let success = false;

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
                  temperature: 0.4,
                  responseMimeType: "application/json",
                },
              }),
            },
          );

          const data = await response.json();
          if (!response.ok) {
            console.warn(
              `Gemini (${model}) gagal [${response.status}]:`,
              data?.error?.message,
            );
            continue;
          }

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
                  id: `${kategori}-${fruitTarget}-${idx}-${Date.now()}`,
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
              setRecipes(formatted);
              success = true;
              break;
            }
          }
        } catch (err: any) {
          console.warn(`Kesalahan jaringan pada ${model}:`, err?.message);
        }
      }

      if (!success) {
        // Gunakan resep cadangan otomatis agar user tetap mendapat ide olahan meski server AI 503
        setRecipes(
          buildFallbackRecipes(fruitTarget, kategori, matchedStock?.imageUri),
        );
        setAiError(null);
      }
      setIsLoadingAI(false);
    },
    [kategori, scannedFruits],
  );

  useEffect(() => {
    if (selectedFruit) {
      generateRecipesWithGemini(selectedFruit);
    } else {
      setRecipes([]);
    }
  }, [selectedFruit, generateRecipesWithGemini]);

  const filteredRecipes = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(kw) ||
        r.subtitle.toLowerCase().includes(kw) ||
        r.fruitName.toLowerCase().includes(kw),
    );
  }, [recipes, searchQuery]);

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
              <Text style={styles.loadingTitle}>Memeriksa Stok Buah...</Text>
            </View>
          ) : scannedFruits.length === 0 ? (
            /* Tampilan Kosong Jika User Belum Pernah Foto/Scan Buah */
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons
                name="food-apple-outline"
                size={52}
                color="#C8201B"
              />
              <Text style={styles.emptyTitle}>Belum Ada Buah yang Di-scan</Text>
              <Text style={styles.emptySubtitle}>
                Scan atau unggah foto buah terlebih dahulu agar Freshia bisa
                membuatkan resep sesuai buah yang kamu punya.
              </Text>
              <TouchableOpacity
                style={styles.scanNowBtn}
                activeOpacity={0.85}
                onPress={() => router.push("/(tabs)/scanner")}
              >
                <Ionicons name="scan" size={18} color="#FFFFFF" />
                <Text style={styles.scanNowText}>Scan Buah Sekarang</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Info Stok Buah Hasil Scan */}
              <View style={styles.stockBanner}>
                <MaterialCommunityIcons
                  name="chef-hat"
                  size={22}
                  color="#9A1B17"
                />
                <Text style={styles.stockBannerText}>
                  Buah hasil scan kamu:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {scannedFruits.map((f) => f.name).join(", ")}
                  </Text>
                </Text>
              </View>

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
                  placeholder="Cari resep olahan buah..."
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

              {/* Filter Chip HANYA Buah Hasil Scan User */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {scannedFruits.map((fruit) => {
                  const isActive =
                    selectedFruit.toLowerCase() === fruit.name.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={fruit.name}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => setSelectedFruit(fruit.name)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isActive && styles.chipTextActive,
                        ]}
                      >
                        {fruit.name} ({fruit.freshness}%)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Loading / Error / Hasil Resep dari Gemini AI */}
              {isLoadingAI ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="large" color="#C8201B" />
                  <Text style={styles.loadingTitle}>
                    Meracik Resep {selectedFruit}...
                  </Text>
                  <Text style={styles.loadingSubtitle}>
                    AI Freshia sedang menyiapkan ide olahan zero-waste dari
                    hasil scan kamu
                  </Text>
                </View>
              ) : aiError ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={44}
                    color="#C8201B"
                  />
                  <Text style={styles.emptyTitle}>Gagal Memuat Resep AI</Text>
                  <Text style={styles.emptySubtitle}>{aiError}</Text>
                  <TouchableOpacity
                    style={styles.scanNowBtn}
                    activeOpacity={0.85}
                    onPress={() => generateRecipesWithGemini(selectedFruit)}
                  >
                    <Ionicons name="refresh" size={18} color="#FFFFFF" />
                    <Text style={styles.scanNowText}>Coba Lagi</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredRecipes.map((item) => (
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
  stockBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  stockBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#9A1B17",
    lineHeight: 17,
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
  chipRow: {
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2DADA",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: "#FCE8E8",
    borderColor: "#9A1B17",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  chipTextActive: {
    color: "#9A1B17",
    fontWeight: "700",
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
  loadingSubtitle: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
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
