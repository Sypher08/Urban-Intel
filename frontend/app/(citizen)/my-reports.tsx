import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, apiFetch } from "@/src/context/AuthContext";
import { COLORS, SEVERITY_COLOR, STATUS_COLOR } from "@/src/theme";

export default function MyReports() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/incidents/mine", { method: "GET" }, token);
      setItems(data);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.topTitle}>My Reports</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? <ActivityIndicator size="large" color={COLORS.brand} style={{ marginTop: 40 }} /> : (
        <FlatList
          testID="reports-list"
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No reports yet</Text>
              <Text style={styles.emptySub}>Tap &quot;Report Incident&quot; on the home screen to file your first report.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sev = SEVERITY_COLOR[item.final_severity] || SEVERITY_COLOR.Medium;
            const st = STATUS_COLOR[item.status] || STATUS_COLOR.New;
            return (
              <TouchableOpacity
                testID={`report-${item.id}`}
                style={styles.card}
                onPress={() => router.push({ pathname: "/(citizen)/incident/[id]", params: { id: item.id } })}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.badge, { backgroundColor: sev.bg }]}><Text style={[styles.badgeText, { color: sev.fg }]}>{item.final_severity}</Text></View>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.fg }]}>{item.status}</Text></View>
                  {item.is_sos && <View style={[styles.badge, { backgroundColor: COLORS.criticalLight }]}><Text style={[styles.badgeText, { color: "#B91C1C" }]}>SOS</Text></View>}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.description || "(no description)"}</Text>
                <View style={styles.cardFooter}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.cardFooterText}>{item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}</Text>
                  <Text style={styles.cardFooterDot}>•</Text>
                  <Text style={styles.cardFooterText}>{(item.recommended_services || [item.service]).join(", ")}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  topTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  cardRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  cardTitle: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
  cardFooterText: { fontSize: 11, color: COLORS.textSecondary },
  cardFooterDot: { color: COLORS.textMuted, marginHorizontal: 4 },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6, textAlign: "center" },
});
