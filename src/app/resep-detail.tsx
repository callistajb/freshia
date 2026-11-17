import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

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

export default function ResepDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipeData?: string;
    kategori?: string;
  }>();

  const recipe: RecipeDetailItem = useMemo(() => {
    try {
      if (params.recipeData) {
        return JSON.parse(params.recipeData);
      }
    } catch {
      // ignore parse error
    }
    return {
      id: "default",
      title: "Olahan Buah Segar",
      subtitle: "Resep sehat dan praktis dari Freshia",
      fruitName: "Buah Segar",
      prepTime: "15 Menit",
      difficulty: "Mudah",
      calories: "180 kkal",
      ingredients: [
        "200 gram buah segar pilihan",
        "1 sdm madu murni",
        "Air matang atau susu secukupnya",
      ],
      steps: [
        "Cuci bersih buah dan potong sesuai selera.",
        "Campurkan seluruh bahan ke dalam wadah atau blender.",
        "Sajikan segera selagi segar.",
      ],
    };
  }, [params.recipeData]);

  const [checkedIngredients, setCheckedIngredients] = useState<
    Record<number, boolean>
  >({});

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
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

        <Text style={styles.headerTitle}>Detail Resep</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* Body Putih Melengkung */}
      <View style={styles.whiteBody}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Kartu Hero Gambar & Judul Resep */}
          <View style={styles.heroCard}>
            <View style={styles.heroImageBox}>
              {recipe.imageUri ? (
                <Image
                  source={{ uri: recipe.imageUri }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={require("../../assets/images/apel makan.png")}
                  style={styles.heroFallback}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={styles.fruitBadge}>
              <MaterialCommunityIcons
                name="food-apple"
                size={14}
                color="#9A1B17"
              />
              <Text style={styles.fruitBadgeText}>
                Bahan Utama: {recipe.fruitName}
              </Text>
            </View>

            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <Text style={styles.recipeSubtitle}>{recipe.subtitle}</Text>

            {/* 3 Info Singkat: Waktu | Tingkat | Kalori */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={18} color="#C8201B" />
                <Text style={styles.metaLabel}>Waktu</Text>
                <Text style={styles.metaValue}>{recipe.prepTime}</Text>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaItem}>
                <Ionicons
                  name="speedometer-outline"
                  size={18}
                  color="#C8201B"
                />
                <Text style={styles.metaLabel}>Tingkat</Text>
                <Text style={styles.metaValue}>{recipe.difficulty}</Text>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={18} color="#C8201B" />
                <Text style={styles.metaLabel}>Energi</Text>
                <Text style={styles.metaValue}>{recipe.calories}</Text>
              </View>
            </View>
          </View>

          {/* Kartu Bahan-Bahan (Bisa dicentang) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="basket-outline"
                size={20}
                color="#9A1B17"
              />
              <Text style={styles.sectionTitle}>Bahan-Bahan</Text>
            </View>

            {recipe.ingredients.map((ing: string, index: number) => {
              const checked = !!checkedIngredients[index];
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.ingredientRow}
                  activeOpacity={0.75}
                  onPress={() => toggleIngredient(index)}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={20}
                    color={checked ? "#32A852" : "#9A1B17"}
                  />
                  <Text
                    style={[
                      styles.ingredientText,
                      checked && styles.ingredientTextChecked,
                    ]}
                  >
                    {ing}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Kartu Langkah Pembuatan */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="chef-hat"
                size={20}
                color="#9A1B17"
              />
              <Text style={styles.sectionTitle}>Cara Membuat</Text>
            </View>

            {recipe.steps.map((step: string, index: number) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
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
    fontSize: 19,
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
    paddingTop: 20,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2E2",
    borderRadius: 22,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  heroImageBox: {
    width: "100%",
    height: 165,
    borderRadius: 16,
    backgroundColor: "#FCE8E8",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 14,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFallback: {
    width: 120,
    height: 120,
  },
  fruitBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE8E8",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 5,
    marginBottom: 8,
  },
  fruitBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#9A1B17",
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 4,
  },
  recipeSubtitle: {
    fontSize: 12.5,
    color: "#666666",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    backgroundColor: "#FFF5F5",
    borderRadius: 16,
    paddingVertical: 12,
  },
  metaItem: {
    alignItems: "center",
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E8D2D2",
  },
  metaLabel: {
    fontSize: 11,
    color: "#666666",
    marginTop: 3,
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2E2",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#9A1B17",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#F5EFEF",
  },
  ingredientText: {
    flex: 1,
    fontSize: 13,
    color: "#1C1C1E",
    lineHeight: 18,
  },
  ingredientTextChecked: {
    textDecorationLine: "line-through",
    color: "#9E9E9E",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  stepNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#C8201B",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: "#1C1C1E",
    lineHeight: 19,
  },
});
