import { StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil Pengguna</Text>
      <Text>Pengaturan akun dan preferensi mode akan ada di sini.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1b5e20", marginBottom: 8 },
});
