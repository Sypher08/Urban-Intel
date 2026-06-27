import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS } from "@/src/theme";
import { useEffect, useRef } from "react";

export default function CitizenHome() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const sos = () => {
    Alert.alert(
      "SOS Emergency",
      "Send instant emergency alert with your current GPS location?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send SOS", style: "destructive", onPress: () => router.push({ pathname: "/(citizen)/report", params: { sos: "1" } }) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hello, {user?.name?.split(" ")[0] || "Citizen"}</Text>
          <Text style={styles.subtitle}>Stay safe. Report responsibly.</Text>
        </View>
        <TouchableOpacity testID="logout-btn" onPress={async () => { await signOut(); router.replace("/auth/login"); }}>
          <View style={styles.avatar}><Ionicons name="log-out-outline" size={20} color={COLORS.text} /></View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.sosWrap}>
          <Animated.View style={[styles.sosRing, { transform: [{ scale: pulse }] }]} />
          <TouchableOpacity testID="sos-button" activeOpacity={0.85} onPress={sos} style={styles.sosBtn}>
            <Ionicons name="warning" size={42} color="#fff" />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sosCaption}>Hold steady. One tap to alert nearest responders.</Text>

        <View style={styles.bentoGrid}>
          <TouchableOpacity testID="bento-report" style={[styles.bento, styles.bentoLg]} onPress={() => router.push("/(citizen)/report")}>
            <Ionicons name="add-circle" size={32} color={COLORS.brand} />
            <Text style={styles.bentoTitle}>Report Incident</Text>
            <Text style={styles.bentoSub}>Photo + AI triage</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="bento-reports" style={styles.bento} onPress={() => router.push("/(citizen)/my-reports")}>
            <Ionicons name="list" size={28} color={COLORS.info} />
            <Text style={styles.bentoTitle}>My Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="bento-tips" style={styles.bento} onPress={() => Alert.alert("Safety Tips", "1. Stay calm.\n2. Move to a safe distance.\n3. Provide a clear photo.\n4. Mark exact location.")}>
            <Ionicons name="bulb" size={28} color={COLORS.warning} />
            <Text style={styles.bentoTitle}>Safety Tips</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reputationCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.repLabel}>TRUST SCORE</Text>
            <Text style={styles.repValue}>{user?.reputation ?? 0}</Text>
            <Text style={styles.repSub}>Earn points by submitting verified reports.</Text>
          </View>
          <Ionicons name="ribbon" size={48} color={COLORS.brand} />
        </View>

        <View style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <Ionicons name="shield-checkmark" size={22} color={COLORS.warning} />
            <Text style={styles.safetyTitle}>Safety Tips</Text>
          </View>
          <View style={styles.safetyItem}>
            <View style={styles.safetyDot} />
            <Text style={styles.safetyText}>Stay calm and move to a safe distance before taking photos.</Text>
          </View>
          <View style={styles.safetyItem}>
            <View style={styles.safetyDot} />
            <Text style={styles.safetyText}>Enable GPS so responders can find your exact location.</Text>
          </View>
          <View style={styles.safetyItem}>
            <View style={styles.safetyDot} />
            <Text style={styles.safetyText}>Provide clear, well-lit photos of the incident scene.</Text>
          </View>
          <View style={styles.safetyItem}>
            <View style={styles.safetyDot} />
            <Text style={styles.safetyText}>Do not approach hazards — wait for trained responders.</Text>
          </View>
          <View style={styles.safetyItem}>
            <View style={styles.safetyDot} />
            <Text style={styles.safetyText}>Keep emergency contact numbers readily accessible.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hello: { fontSize: 24, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 24, paddingTop: 8 },
  sosWrap: { alignItems: "center", justifyContent: "center", marginTop: 24, height: 220 },
  sosRing: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: COLORS.critical, opacity: 0.15 },
  sosBtn: { width: 168, height: 168, borderRadius: 84, backgroundColor: COLORS.critical, alignItems: "center", justifyContent: "center", shadowColor: COLORS.critical, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  sosText: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: 2, marginTop: 4 },
  sosCaption: { textAlign: "center", color: COLORS.textSecondary, marginTop: 16, marginBottom: 28, fontSize: 13 },
  bentoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  bento: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, width: "48%", gap: 8, minHeight: 110 },
  bentoLg: { width: "100%" },
  bentoTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  bentoSub: { fontSize: 12, color: COLORS.textSecondary },
  reputationCard: { marginTop: 16, backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 16 },
  repLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary },
  repValue: { fontSize: 32, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  repSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  safetyCard: { marginTop: 16, backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  safetyHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  safetyTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  safetyItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  safetyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning, marginTop: 6 },
  safetyText: { fontSize: 14, color: COLORS.text, flex: 1, lineHeight: 20 },
});
