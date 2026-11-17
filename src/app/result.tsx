import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface AnalysisData {
  freshnessPercentage: number;
  salvageValue: string;
  shelfLife: string;
  recipe: string;
}

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    detection?: string;
    mode?: string;
    imageUri?: string;
    analysis?: string;
  }>();

  const [fruitName, setFruitName] = useState<string>(
    params.detection || "Buah",
  );
  const [mode, setMode] = useState<"Bisnis" | "Pribadi">(
    params.mode === "Bisnis" ? "Bisnis" : "Pribadi",
  );
  const [imageUri, setImageUri] = useState<string | undefined>(params.imageUri);
  const [analysis, setAnalysis] = useState<AnalysisData>({
    freshnessPercentage: 0,
    salvageValue: "Rp0",
    shelfLife: "-",
    recipe: "-",
  });

  useEffect(() => {
    // 1. Jika data dikirim langsung lewat params dari Scanner
    if (params.analysis) {
      try {
        const parsed = JSON.parse(params.analysis);
        setAnalysis({
          freshnessPercentage: Number(parsed.freshnessPercentage ?? 0),
          salvageValue: String(parsed.salvageValue ?? "Rp0"),
          shelfLife: String(parsed.shelfLife ?? "-"),
          recipe: String(parsed.recipe ?? "-"),
        });
      } catch (e) {
        console.warn("Gagal parse params analysis:", e);
      }
    }

    // 2. Fallback / sinkronisasi foto & detail dari AsyncStorage (@freshia_history)
    const loadFromLocalHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem("@freshia_history");
        if (!stored) return;
        const list = JSON.parse(stored);
        if (!Array.isArray(list) || list.length === 0) return;

        const matched = params.id
          ? list.find((item: any) => item.id === params.id)
          : list[0];

        if (matched) {
          if (!params.imageUri && matched.image) {
            setImageUri(matched.image);
          }
          if (!params.detection && matched.result?.label) {
            setFruitName(matched.result.label);
          }
          if (!params.mode && matched.mode) {
            setMode(matched.mode === "Bisnis" ? "Bisnis" : "Pribadi");
          }
          if (!params.analysis && matched.result?.analysis) {
            setAnalysis({
              freshnessPercentage: Number(
                matched.result.analysis.freshnessPercentage ?? 0,
              ),
              salvageValue: String(
                matched.result.analysis.salvageValue ?? "Rp0",
              ),
              shelfLife: String(matched.result.analysis.shelfLife ?? "-"),
              recipe: String(matched.result.analysis.recipe ?? "-"),
            });
          }
        }
      } catch (err) {
        console.warn("Gagal memuat detail dari AsyncStorage:", err);
      }
    };

    loadFromLocalHistory();
  }, [
    params.id,
    params.detection,
    params.mode,
    params.imageUri,
    params.analysis,
  ]);

  const percent = Math.min(100, Math.max(0, analysis.freshnessPercentage));
  const isBisnis = mode === "Bisnis";

  // Deteksi apakah objek yang dipindai bukan buah
  const isNotFruit =
    percent === 0 &&
    (fruitName.toLowerCase() === "buah" ||
      fruitName.toLowerCase() === "unknown" ||
      analysis.recipe.toLowerCase().includes("tidak ada buah") ||
      analysis.recipe.toLowerCase().includes("bukan buah") ||
      analysis.recipe.toLowerCase().includes("gagal"));

  const displayFruitName = isNotFruit
    ? "Bukan Buah (Tidak Terdeteksi)"
    : fruitName;

  // Warna & Label Status Kesegaran Dinamis
  const getFreshnessMeta = (pct: number, notFruit: boolean) => {
    if (notFruit) {
      return {
        label: "Bukan Buah",
        color: "#8E8E93",
        bgTint: "#F2F2F7",
      };
    }
    if (pct >= 75) {
      return {
        label: "Sangat Segar",
        color: "#4CD964",
        bgTint: "#DCF8E1",
      };
    }
    if (pct >= 45) {
      return {
        label: "Cukup Segar",
        color: "#FF9500",
        bgTint: "#FFF0D6",
      };
    }
    return {
      label: "Hampir Busuk",
      color: "#E03A3E",
      bgTint: "#FCE0E0",
    };
  };

  const freshnessMeta = getFreshnessMeta(percent, isNotFruit);

  // Memecah estimasi harga jual & keuntungan untuk Mode Bisnis
  const parseBusinessValues = (rawSalvage: string) => {
    if (rawSalvage.includes("|")) {
      const [harga, untung] = rawSalvage.split("|").map((s) => s.trim());
      return { hargaJual: harga || "Rp0", keuntungan: untung || "Rp0" };
    }
    const numericOnly = Number(rawSalvage.replace(/[^0-9]/g, ""));
    if (!Number.isNaN(numericOnly) && numericOnly > 0) {
      const estProfit = Math.round(numericOnly * 0.32);
      return {
        hargaJual: `Rp${numericOnly.toLocaleString("id-ID")}`,
        keuntungan: `Rp${estProfit.toLocaleString("id-ID")}`,
      };
    }
    return {
      hargaJual: rawSalvage || "Rp0",
      keuntungan: "Rp0",
    };
  };

  const { hargaJual, keuntungan } = parseBusinessValues(analysis.salvageValue);

  // Memecah saran resep dari Gemini menjadi daftar item kartu untuk Mode Pribadi
  const parseRecipeList = (rawRecipe: string) => {
    if (!rawRecipe || rawRecipe === "-") {
      return [
        {
          title: `Olahan ${fruitName} Segar`,
          subtitle: "Camilan sehat dan praktis siap saji",
        },
      ];
    }

    const lines = rawRecipe
      .split(/\n|•|\d+\.\s/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);

    if (lines.length >= 2) {
      return lines.slice(0, 3).map((line) => {
        const [titlePart, ...descParts] = line.split(":");
        return {
          title: titlePart.trim(),
          subtitle:
            descParts.join(":").trim() || "Olahan lezat anti food-waste",
        };
      });
    }

    return [
      {
        title: `Kreasi ${fruitName}`,
        subtitle: rawRecipe,
      },
    ];
  };

  const recipeItems = parseRecipeList(analysis.recipe);

  // Navigasi ke halaman resep-list sesuai kategori (makanan / minuman) & nama buah
  const handleOpenRecipeRecommendation = (title: string) => {
    const lowerTitle = title.toLowerCase();
    const isDrink =
      lowerTitle.includes("jus") ||
      lowerTitle.includes("smoothie") ||
      lowerTitle.includes("minuman") ||
      lowerTitle.includes("es ") ||
      lowerTitle.includes("infused") ||
      lowerTitle.includes("milkshake") ||
      lowerTitle.includes("sirup");

    router.push({
      pathname: "/resep-list",
      params: {
        kategori: isDrink ? "minuman" : "makanan",
        fruit: fruitName,
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
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hasil Analisis</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Body Putih Melengkung */}
      <View style={styles.whiteBody}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Pill Mode Merah (Bisnis / Pribadi) */}
          <View style={styles.modeBanner}>
            {isBisnis ? (
              <Ionicons name="bag-handle-outline" size={18} color="#FFFFFF" />
            ) : (
              <Ionicons name="person-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.modeBannerText}>{mode}</Text>
          </View>

          {/* Kartu 1: Foto Buah & Nama Buah */}
          <View style={styles.fruitCard}>
            <View style={styles.fruitImageWrapper}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.fruitImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.fruitImageFallback}>
                  <MaterialCommunityIcons
                    name="food-apple"
                    size={54}
                    color="#9A1B17"
                  />
                </View>
              )}
            </View>

            <View style={styles.fruitNameSection}>
              <Text style={styles.fruitNameLabel}>
                Nama Buah :{" "}
                <Text style={styles.fruitNameValue}>{displayFruitName}</Text>
              </Text>
            </View>
          </View>

          {/* Kartu 2: Rate Kesegaran */}
          <View style={styles.card}>
            <View style={styles.freshnessLeft}>
              <View style={styles.cardHeaderRow}>
                <MaterialCommunityIcons
                  name="leaf"
                  size={18}
                  color={isNotFruit ? "#8E8E93" : "#4CD964"}
                />
                <Text style={styles.cardTitle}>Rate Kesegaran</Text>
              </View>

              <Text style={styles.bigPercentText}>{percent}%</Text>

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: freshnessMeta.bgTint },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: freshnessMeta.color },
                  ]}
                >
                  {freshnessMeta.label}
                </Text>
              </View>
            </View>

            {/* Lingkaran Indikator Persentase */}
            <View
              style={[styles.circleGauge, { borderColor: freshnessMeta.color }]}
            >
              <Text
                style={[styles.circleGaugeText, { color: freshnessMeta.color }]}
              >
                {percent}%
              </Text>
            </View>
          </View>

          {/* Jika Bukan Buah, Tampilkan Banner Peringatan Jelas */}
          {isNotFruit ? (
            <View style={styles.notFruitCard}>
              <View style={styles.notFruitIconCircle}>
                <Ionicons name="alert-circle" size={32} color="#C8201B" />
              </View>
              <Text style={styles.notFruitTitle}>
                Objek Bukan Buah Terdeteksi
              </Text>
              <Text style={styles.notFruitDesc}>
                Sistem tidak mendeteksi gambar buah yang valid. Silakan ulangi
                pemindaian dan arahkan kamera tepat ke arah buah.
              </Text>
              <TouchableOpacity
                style={styles.retryScanButton}
                activeOpacity={0.85}
                onPress={() => router.back()}
              >
                <Text style={styles.retryScanButtonText}>Scan Ulang Buah</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Kartu 3: Perkiraan bisa dijual (Bisnis) / Perkiraan expired (Pribadi) */}
              <View style={styles.pinkShelfCard}>
                <View style={styles.calendarIconBox}>
                  <Ionicons name="calendar-outline" size={26} color="#C8201B" />
                </View>
                <View style={styles.shelfTextCol}>
                  <Text style={styles.shelfLabel}>
                    {isBisnis ? "Perkiraan bisa dijual" : "Perkiraan expired"}
                  </Text>
                  <Text style={styles.shelfValue}>{analysis.shelfLife}</Text>
                </View>
              </View>

              {/* Kartu 4: Dinamis Sesuai Mode */}
              {isBisnis ? (
                /* KARTU MODE BISNIS: Keuntungan Jual */
                <View style={styles.bottomSectionCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.dollarCircle}>
                      <Text style={styles.dollarSymbol}>$</Text>
                    </View>
                    <Text style={styles.cardTitle}>Keuntungan Jual</Text>
                  </View>

                  <View style={styles.profitBox}>
                    <View style={styles.profitCol}>
                      <Text style={styles.profitLabel}>
                        Estimasi Harga Jual
                      </Text>
                      <Text style={styles.profitValue}>{hargaJual}</Text>
                    </View>

                    <View style={styles.profitDivider} />

                    <View style={styles.profitCol}>
                      <Text style={styles.profitLabel}>
                        Estimasi Keuntungan
                      </Text>
                      <Text style={styles.profitValue}>{keuntungan}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                /* KARTU MODE PRIBADI: Bisa diolah menjadi */
                <View style={styles.bottomSectionCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialCommunityIcons
                      name="chef-hat"
                      size={20}
                      color="#C8201B"
                    />
                    <Text style={styles.cardTitle}>Bisa diolah menjadi</Text>
                  </View>

                  {recipeItems.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.recipeItemCard}
                      activeOpacity={0.85}
                      onPress={() => handleOpenRecipeRecommendation(item.title)}
                    >
                      <View style={styles.recipeThumbBox}>
                        {imageUri ? (
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.recipeThumbImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="silverware-fork-knife"
                            size={24}
                            color="#9A1B17"
                          />
                        )}
                      </View>

                      <View style={styles.recipeTextCol}>
                        <Text style={styles.recipeItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.recipeItemSub} numberOfLines={2}>
                          {item.subtitle}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#1C1C1E"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
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
    paddingTop: Platform.OS === "ios" ? 56 : 38,
    paddingHorizontal: 18,
    paddingBottom: 28,
    backgroundColor: "#C8201B",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 36,
  },

  /* Body Putih Melengkung */
  whiteBody: {
    flex: 1,
    backgroundColor: "#FFFBFB",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* Pill Mode Merah */
  modeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#C8201B",
    height: 40,
    borderRadius: 20,
    marginBottom: 16,
  },
  modeBannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Kartu 1: Foto & Nama Buah */
  fruitCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EFE8E8",
    overflow: "hidden",
    marginBottom: 14,
  },
  fruitImageWrapper: {
    width: "100%",
    height: 165,
    backgroundColor: "#F5EDED",
  },
  fruitImage: {
    width: "100%",
    height: "100%",
  },
  fruitImageFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fruitNameSection: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: -14,
  },
  fruitNameLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  fruitNameValue: {
    fontWeight: "500",
    color: "#1C1C1E",
  },

  /* Kartu 2: Rate Kesegaran */
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EFE8E8",
    padding: 18,
    marginBottom: 14,
  },
  freshnessLeft: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  bigPercentText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  circleGauge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  circleGaugeText: {
    fontSize: 20,
    fontWeight: "700",
  },

  /* Kartu Peringatan Bukan Buah */
  notFruitCard: {
    backgroundColor: "#FCE8E8",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 14,
  },
  notFruitIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F8CACA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  notFruitTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#9A1B17",
    marginBottom: 6,
    textAlign: "center",
  },
  notFruitDesc: {
    fontSize: 12.5,
    color: "#333333",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  retryScanButton: {
    backgroundColor: "#C8201B",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  retryScanButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Kartu 3: Perkiraan bisa dijual / expired */
  pinkShelfCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  calendarIconBox: {
    marginRight: 14,
  },
  shelfTextCol: {
    flex: 1,
  },
  shelfLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#C8201B",
    marginBottom: 2,
  },
  shelfValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1C1E",
  },

  /* Kartu 4: Bottom Section (Bisnis & Pribadi) */
  bottomSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EFE8E8",
    padding: 16,
  },
  dollarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#C8201B",
    justifyContent: "center",
    alignItems: "center",
  },
  dollarSymbol: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C8201B",
  },
  profitBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  profitCol: {
    flex: 1,
    alignItems: "center",
  },
  profitDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E5A5A5",
  },
  profitLabel: {
    fontSize: 11,
    color: "#333333",
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1C1E",
  },

  /* Kartu Item Resep Mode Pribadi */
  recipeItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE8E8",
    borderRadius: 14,
    padding: 8,
    marginTop: 8,
  },
  recipeThumbBox: {
    width: 58,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FCE8E8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recipeThumbImg: {
    width: "100%",
    height: "100%",
  },
  recipeTextCol: {
    flex: 1,
    paddingRight: 6,
  },
  recipeItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  recipeItemSub: {
    fontSize: 11,
    color: "#555555",
    lineHeight: 15,
  },
});
