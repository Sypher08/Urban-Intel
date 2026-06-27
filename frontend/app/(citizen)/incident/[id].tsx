import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuth, apiFetch } from "@/src/context/AuthContext";
import { COLORS, SEVERITY_COLOR, STATUS_COLOR } from "@/src/theme";

const STAGES = ["New", "Acknowledged", "EnRoute", "OnScene", "Resolved"];

export default function IncidentDetail() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [incident, setIncident] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const pingTimer = useRef<any>(null);

  const load = useCallback(async () => {
    try { setIncident(await apiFetch(`/incidents/${id}`, { method: "GET" }, token)); } catch {}
    setRefreshing(false);
  }, [id, token]);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 15s so citizen sees ETA/status update
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    return () => {
      if (watcher.current) { try { watcher.current.remove(); } catch {} }
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, []);

  const pushPing = async (lat: number, lng: number, accuracy?: number) => {
    try {
      await apiFetch(`/incidents/${id}/track`, {
        method: "POST",
        body: JSON.stringify({ latitude: lat, longitude: lng, accuracy }),
      }, token);
    } catch {}
  };

  const toggleTracking = async () => {
    if (tracking) {
      if (watcher.current) {
        try { watcher.current.remove(); } catch {}
        watcher.current = null;
      }
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
      setTracking(false);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow location to share live position with dispatch.");
      return;
    }
    setTracking(true);
    const ping = async () => {
      try {
        const p = await Location.getCurrentPositionAsync({});
        pushPing(p.coords.latitude, p.coords.longitude, p.coords.accuracy ?? undefined);
      } catch {}
    };
    await ping();
    pingTimer.current = setInterval(ping, 12000);
  };

  if (!incident) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brand} /></SafeAreaView>;

  const stageIdx = STAGES.indexOf(incident.status);
  const sev = SEVERITY_COLOR[incident.final_severity] || SEVERITY_COLOR.Medium;
  const st = STATUS_COLOR[incident.status] || STATUS_COLOR.New;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.topTitle}>Incident</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {incident.image_base64 && (
          <Image source={{ uri: `data:image/jpeg;base64,${incident.image_base64}` }} style={styles.hero} />
        )}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: sev.bg }]}><Text style={[styles.badgeText, { color: sev.fg }]}>{incident.final_severity}</Text></View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.fg }]}>{incident.status}</Text></View>
          {incident.is_sos && <View style={[styles.badge, { backgroundColor: COLORS.criticalLight }]}><Text style={[styles.badgeText, { color: "#B91C1C" }]}>SOS</Text></View>}
        </View>
        <Text style={styles.desc}>{incident.description}</Text>

        {incident.ai_analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHead}><Ionicons name="sparkles" size={16} color={COLORS.brand} /><Text style={styles.sectionTitle}>AI Triage</Text></View>
            <Text style={styles.row}><Text style={styles.k}>Type: </Text>{incident.ai_analysis.incident_type}</Text>
            <Text style={styles.row}><Text style={styles.k}>Confidence: </Text>{Math.round((incident.ai_analysis.confidence || 0) * 100)}%</Text>
            <Text style={styles.row}><Text style={styles.k}>Reasoning: </Text>{incident.ai_analysis.reasoning}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESPONSE TIMELINE</Text>
          {STAGES.map((s, i) => {
            const done = i <= stageIdx;
            return (
              <View key={s} style={styles.tlRow}>
                <View style={[styles.tlDot, done && { backgroundColor: COLORS.brand }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tlLabel, done && { color: COLORS.text, fontWeight: "700" }]}>{s === "EnRoute" ? "En Route" : s === "OnScene" ? "On Scene" : s}</Text>
                </View>
                {done && <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />}
              </View>
            );
          })}
        </View>

        {(incident.eta_minutes || incident.responder_vehicle) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RESPONDER</Text>
            {incident.eta_minutes != null && <Text style={styles.row}><Text style={styles.k}>ETA: </Text>{incident.eta_minutes} min</Text>}
            {incident.responder_vehicle && <Text style={styles.row}><Text style={styles.k}>Vehicle: </Text>{incident.responder_vehicle}</Text>}
          </View>
        )}

        {user?.role === "citizen" && incident.status !== "Resolved" && (
          <TouchableOpacity testID="toggle-tracking" style={[styles.trackBtn, tracking && { backgroundColor: COLORS.critical }]} onPress={toggleTracking}>
            <Ionicons name={tracking ? "stop-circle" : "navigate"} size={18} color="#fff" />
            <Text style={styles.trackText}>{tracking ? "Stop sharing location" : "Share live location with dispatch"}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DISPATCH</Text>
          <Text style={styles.row}><Text style={styles.k}>Services: </Text>{(incident.recommended_services || []).join(", ")}</Text>
          <Text style={styles.row}><Text style={styles.k}>Location: </Text>{incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  topTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  hero: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  desc: { fontSize: 15, color: COLORS.text, lineHeight: 22, marginBottom: 8 },
  section: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 10 },
  row: { fontSize: 14, color: COLORS.text, marginTop: 4 },
  k: { color: COLORS.textSecondary, fontWeight: "700" },
  tlRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.border },
  tlLabel: { fontSize: 14, color: COLORS.textMuted },
  trackBtn: { marginTop: 16, backgroundColor: COLORS.brand, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  trackText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
