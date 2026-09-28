import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";

// Mengimpor komponen layar dari folder screens
import HistoryScreen from "./screens/HistoryScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ScannerScreen from "./screens/ScannerScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ tabBarActiveTintColor: "#2e7d32" }}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Beranda" }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: "Riwayat" }}
        />
        <Tab.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ title: "Scan AI" }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: "Profil" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
