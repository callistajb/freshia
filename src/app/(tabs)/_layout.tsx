import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#9A1B17",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={focused ? "#9A1B17" : "#8E8E93"}
            />
          ),
        }}
      />

      {/* 2. History */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="file-document-outline"
              size={24}
              color={focused ? "#9A1B17" : "#8E8E93"}
            />
          ),
        }}
      />

      {/* 3. Scanner (Tombol Bulat Merah di Tengah) */}
      <Tabs.Screen
        name="scanner"
        options={{
          title: "",
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.scanButtonWrapper}>
              <MaterialCommunityIcons
                name="line-scan"
                size={28}
                color="#FFFFFF"
              />
            </View>
          ),
        }}
      />

      {/* 4. Resep */}
      <Tabs.Screen
        name="resep"
        options={{
          title: "Resep",
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="chef-hat"
              size={24}
              color={focused ? "#9A1B17" : "#8E8E93"}
            />
          ),
        }}
      />

      {/* 5. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={focused ? "#9A1B17" : "#8E8E93"}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 84 : 70,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    elevation: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  scanButtonWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#9A1B17",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 28 : 26,
    elevation: 8,
    shadowColor: "#9A1B17",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
