// PLACEHOLDER — bootstrapped by Rishith so the Expo app runs and the data layer
// (src/services, src/hooks, src/types) is importable.
//
// WESLEY owns this file and everything under src/screens, src/components,
// src/navigation, src/utils. Replace this with the real App + TabNavigator.
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PEGASUS</Text>
      <Text style={styles.sub}>your mind's check engine light</Text>
      <Text style={styles.note}>
        Data layer ready in src/. Wesley builds screens here.
      </Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: "#ffffff", fontSize: 44, fontWeight: "800", letterSpacing: 3 },
  sub: { color: "#9ca3af", marginTop: 6, fontSize: 16 },
  note: { color: "#4b5563", marginTop: 28, fontSize: 13, textAlign: "center" },
});
