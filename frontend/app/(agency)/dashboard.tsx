import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, ScrollView, Image, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, apiFetch } from "@/src/context/AuthContext";
import { COLORS, SEVERITY_COLOR, STATUS_COLOR } from "@/src/theme";

const STATUSES = ["New", "Acknowledged", "EnRoute", "OnScene", "Resolved"];

export default function AgencyDashboard() {
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [track, setTrack] = useState<any | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([
        apiFetch("/admin/analytics", { method: "GET" }, token),
        apiFetch(`/incidents${filter !== "All" ? `?status_filter=${filter}` : ""}`, { method: "GET" }, token),
      ]);
      setAnalytics(a); setIncidents(i);
    } catch (e: any) {
      Alert.alert("Load failed", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Auto-refresh every 10s for live console feel
  useEffect(() => {
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const advance = async (incidentId: string, currentStatus: string) => {
    const idx = STATUSES.indexOf(currentStatus);
    const next = STATUSES[Math.min(idx + 1, STATUSES.length - 1)];
    try {
      const updated = await apiFetch(`/incidents/${incidentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: next,
          eta_minutes: next === "EnRoute" ? Math.floor(Math.random() * 12) + 4 : undefined,
          responder_vehicle: next === "Acknowledged" ? `UI-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
        }),
      }, token);
      if (detail && detail.id === incidentId) setDetail(updated);
      load();
    } catch (e: any) {
      Alert.alert("Update failed", e.message);
    }
  };

  const openDetail = async (item: any) => {
    setDetail(item); setTrack(null); setTrackLoading(true);
    try {
      const t = await apiFetch(`/incidents/${item.id}/track`, { method: "GET" }, token);
      setTrack(t);
    } catch {}
    setTrackLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dashTitle}>Dispatch Console</Text>
          <Text style={styles.dashSub}>{user?.role === "admin" ? "Admin" : user?.agency_type || "Agency"} • {user?.name}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {user?.role === "admin" && (
            <TouchableOpacity testID="db-btn" onPress={() => router.push("/(agency)/db-admin")}>
              <View style={styles.avatar}><Ionicons name="server" size={20} color={COLORS.text} /></View>
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="logout-btn" onPress={async () => { await signOut(); router.replace("/auth/login"); }}>
            <View style={styles.avatar}><Ionicons name="log-out-outline" size={20} color={COLORS.text} /></View>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color={COLORS.brand} style={{ marginTop: 40 }} /> : (
        <FlatList
          testID="incidents-list"
          data={incidents}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View>
              {analytics && (
                <View style={styles.statsRow}>
                  <StatCard label="Total" value={analytics.total} color={COLORS.brand} />
                  <StatCard label="Active" value={analytics.active} color={COLORS.warning} />
                  <StatCard label="Resolved" value={analytics.resolved} color={COLORS.success} />
                </View>
              )}
              {analytics && (
                <View style={styles.breakRow}>
                  <View style={styles.breakCard}>
                    <Text style={styles.breakTitle}>BY SEVERITY</Text>
                    {Object.entries(analytics.by_severity).map(([k, v]) => (
                      <View key={k} style={styles.breakLine}><Text style={styles.breakLabel}>{k}</Text><Text style={styles.breakVal}>{v as number}</Text></View>
                    ))}
                  </View>
                  <View style={styles.breakCard}>
                    <Text style={styles.breakTitle}>BY SERVICE</Text>
                    {Object.entries(analytics.by_service).map(([k, v]) => (
                      <View key={k} style={styles.breakLine}><Text style={styles.breakLabel}>{k}</Text><Text style={styles.breakVal}>{v as number}</Text></View>
                    ))}
                  </View>
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {["All", ...STATUSES].map((f) => (
                  <TouchableOpacity key={f} testID={`filter-${f}`} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
                    <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === "EnRoute" ? "En Route" : f === "OnScene" ? "On Scene" : f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.listLabel}>INCIDENTS ({incidents.length})</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No incidents.</Text>}
          renderItem={({ item }) => {
            const sev = SEVERITY_COLOR[item.final_severity] || SEVERITY_COLOR.Medium;
            const st = STATUS_COLOR[item.status] || STATUS_COLOR.New;
            const idx = STATUSES.indexOf(item.status);
            const canAdvance = idx < STATUSES.length - 1;
            const nextLabel = canAdvance ? STATUSES[idx + 1] : null;
            const ai = item.ai_analysis;
            return (
              <TouchableOpacity style={styles.incCard} onPress={() => openDetail(item)} testID={`inc-${item.id}`}>
                <View style={styles.incRow}>
                  <View style={[styles.badge, { backgroundColor: sev.bg }]}><Text style={[styles.badgeText, { color: sev.fg }]}>{item.final_severity}</Text></View>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.fg }]}>{item.status}</Text></View>
                  {item.is_sos && <View style={[styles.badge, { backgroundColor: COLORS.criticalLight }]}><Text style={[styles.badgeText, { color: "#B91C1C" }]}>SOS</Text></View>}
                  {ai && <View style={[styles.badge, { backgroundColor: COLORS.brand }]}><Ionicons name="sparkles" size={9} color="#fff" /><Text style={[styles.badgeText, { color: "#fff", marginLeft: 3 }]}>{ai.incident_type} {Math.round((ai.confidence || 0) * 100)}%</Text></View>}
                </View>
                <Text style={styles.incTitle} numberOfLines={2}>{item.description}</Text>
                {ai && <Text style={styles.aiPreview} numberOfLines={1}>AI: {ai.reasoning}</Text>}
                {ai?.mismatch_warning && (
                  <View style={styles.warnRow}><Ionicons name="warning" size={12} color="#92400E" /><Text style={styles.warnText} numberOfLines={2}>{ai.mismatch_warning}</Text></View>
                )}
                <Text style={styles.incMeta}>{item.citizen_name} • {(item.recommended_services || []).join(", ")} • {item.latitude.toFixed(3)},{item.longitude.toFixed(3)}</Text>
                {canAdvance && (
                  <TouchableOpacity testID={`advance-${item.id}`} style={styles.advanceBtn} onPress={(e) => { e.stopPropagation?.(); advance(item.id, item.status); }}>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                    <Text style={styles.advanceText}>Mark {nextLabel === "EnRoute" ? "En Route" : nextLabel === "OnScene" ? "On Scene" : nextLabel}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
          <View style={styles.topBar}>
            <TouchableOpacity testID="modal-close" onPress={() => setDetail(null)}><Ionicons name="close" size={26} color={COLORS.text} /></TouchableOpacity>
            <Text style={styles.topTitle}>Incident Detail</Text>
            <View style={{ width: 26 }} />
          </View>
          {detail && (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {detail.image_base64 && <Image source={{ uri: `data:image/jpeg;base64,${detail.image_base64}` }} style={styles.hero} />}
              <Text style={styles.detTitle}>{detail.description}</Text>

              {detail.ai_analysis && (
                <View style={styles.aiBox}>
                  <View style={styles.aiHead}>
                    <Ionicons name="sparkles" size={18} color={COLORS.brand} />
                    <Text style={styles.aiBoxTitle}>AI Triage</Text>
                    <View style={[styles.confPill, { backgroundColor: COLORS.brand }]}><Text style={styles.confText}>{Math.round((detail.ai_analysis.confidence || 0) * 100)}%</Text></View>
                  </View>
                  <Text style={styles.detRow}><Text style={styles.k}>Type: </Text>{detail.ai_analysis.incident_type}</Text>
                  <Text style={styles.detRow}><Text style={styles.k}>AI Severity: </Text>{detail.ai_analysis.ai_severity}</Text>
                  <Text style={styles.detRow}><Text style={styles.k}>Recommends: </Text>{(detail.ai_analysis.recommended_services || []).join(", ")}</Text>
                  <Text style={styles.detReason}>{detail.ai_analysis.reasoning}</Text>
                  {detail.ai_analysis.mismatch_warning && (
                    <View style={styles.warnRow}><Ionicons name="warning" size={14} color="#92400E" /><Text style={styles.warnText}>{detail.ai_analysis.mismatch_warning}</Text></View>
                  )}
                </View>
              )}

              <View style={styles.detSection}>
                <Text style={styles.detLabel}>REPORTER</Text>
                <Text style={styles.detRow}>{detail.citizen_name}</Text>
              </View>

              <View style={styles.detSection}>
                <Text style={styles.detLabel}>LIVE LOCATION TRACKING</Text>
                {trackLoading ? <ActivityIndicator color={COLORS.brand} /> : track ? (
                  <View>
                    <Text style={styles.detRow}><Text style={styles.k}>Origin: </Text>{track.origin.lat.toFixed(5)}, {track.origin.lng.toFixed(5)}</Text>
                    {track.last_position ? (
                      <>
                        <Text style={styles.detRow}><Text style={styles.k}>Last ping: </Text>{track.last_position.lat.toFixed(5)}, {track.last_position.lng.toFixed(5)}</Text>
                        <Text style={styles.detRow}><Text style={styles.k}>At: </Text>{new Date(track.last_position.ts).toLocaleString()}</Text>
                        <Text style={styles.detRow}><Text style={styles.k}>Pings: </Text>{track.track.length}</Text>
                        <TouchableOpacity style={styles.mapLink} onPress={() => {
                          const url = `https://www.openstreetmap.org/?mlat=${track.last_position.lat}&mlon=${track.last_position.lng}&zoom=17`;
                          if (Platform.OS === "web") window.open(url, "_blank");
                          else Alert.alert("Map URL", url);
                        }} testID="open-map">
                          <Ionicons name="map" size={16} color="#fff" />
                          <Text style={styles.mapLinkText}>Open in map</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.detRow}>No live pings yet — citizen has not enabled location sharing.</Text>
                    )}
                  </View>
                ) : <Text style={styles.detRow}>Track unavailable.</Text>}
              </View>

              <View style={styles.detSection}>
                <Text style={styles.detLabel}>RESPONSE</Text>
                <Text style={styles.detRow}><Text style={styles.k}>Status: </Text>{detail.status}</Text>
                {detail.eta_minutes != null && <Text style={styles.detRow}><Text style={styles.k}>ETA: </Text>{detail.eta_minutes} min</Text>}
                {detail.responder_vehicle && <Text style={styles.detRow}><Text style={styles.k}>Vehicle: </Text>{detail.responder_vehicle}</Text>}
                {STATUSES.indexOf(detail.status) < STATUSES.length - 1 && (
                  <TouchableOpacity testID="modal-advance" style={styles.advanceBtnLg} onPress={() => advance(detail.id, detail.status)}>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                    <Text style={styles.advanceText}>Advance to {STATUSES[STATUSES.indexOf(detail.status) + 1]}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  dashTitle: { fontSize: 24, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  dashSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary },
  statVal: { fontSize: 28, fontWeight: "900", marginTop: 6 },
  breakRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  breakCard: { flex: 1, backgroundColor: COLORS.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  breakTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 8 },
  breakLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  breakLabel: { fontSize: 13, color: COLORS.textSecondary },
  breakVal: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  filterRow: { paddingVertical: 4, paddingRight: 8, gap: 6, marginBottom: 12 },
  filterChip: { flexShrink: 0, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  listLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 10 },
  incCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  incRow: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: "row", alignItems: "center" },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  incTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  aiPreview: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontStyle: "italic" },
  warnRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.warningLight, padding: 8, borderRadius: 8 },
  warnText: { color: "#92400E", fontSize: 11, flex: 1 },
  incMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
  advanceBtn: { marginTop: 12, backgroundColor: COLORS.brand, borderRadius: 10, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  advanceBtnLg: { marginTop: 14, backgroundColor: COLORS.brand, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  advanceText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", marginTop: 40, color: COLORS.textSecondary },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  topTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  hero: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },
  detTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  aiBox: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  aiBoxTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text },
  confPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  confText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  detSection: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  detLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 8 },
  detRow: { fontSize: 13, color: COLORS.text, marginTop: 4 },
  detReason: { fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic", marginTop: 6 },
  k: { color: COLORS.textSecondary, fontWeight: "700" },
  mapLink: { marginTop: 12, backgroundColor: COLORS.info, paddingVertical: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  mapLinkText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
