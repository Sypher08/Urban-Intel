import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, apiFetch, BACKEND_URL } from "@/src/context/AuthContext";
import { COLORS } from "@/src/theme";

export default function DbAdmin() {
  const router = useRouter();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await apiFetch("/admin/db-overview", { method: "GET" }, token)); } catch {}
    setLoading(false); setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openDocs = async () => {
    const url = `${BACKEND_URL}/api/project-info`;
    if (Platform.OS === "web") window.open(url, "_blank");
    else await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.topTitle}>Database Overview</Text>
        <TouchableOpacity onPress={openDocs} testID="open-docs"><Ionicons name="document-text" size={22} color={COLORS.brand} /></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
          <TouchableOpacity style={styles.docsBanner} onPress={openDocs} testID="docs-banner">
            <Ionicons name="book" size={22} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.docsTitle}>Project Dossier &amp; AI Accuracy Report</Text>
              <Text style={styles.docsSub}>Architecture · API · CNN code · Precision/Recall/F1</Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#fff" />
          </TouchableOpacity>

          {data && Object.entries(data).map(([coll, info]: [string, any]) => (
            <View key={coll} style={styles.collCard}>
              <View style={styles.collHead}>
                <Ionicons name="server" size={18} color={COLORS.brand} />
                <Text style={styles.collTitle}>{coll}</Text>
                <View style={styles.countPill}><Text style={styles.countText}>{info.count}</Text></View>
              </View>
              <Text style={styles.collSub}>Showing {Math.min(info.recent.length, 20)} most recent (newest first)</Text>
              {info.recent.map((doc: any, i: number) => (
                <View key={i} style={styles.docCard}>
                  <Text style={styles.docKey}>{doc.id || doc.email || `#${i}`}</Text>
                  {coll === "users" && (
                    <>
                      <Text style={styles.docLine}><Text style={styles.k}>email: </Text>{doc.email}</Text>
                      <Text style={styles.docLine}><Text style={styles.k}>role: </Text>{doc.role}{doc.agency_type ? ` (${doc.agency_type})` : ""}</Text>
                      <Text style={styles.docLine}><Text style={styles.k}>reputation: </Text>{doc.reputation ?? 0}</Text>
                    </>
                  )}
                  {coll === "incidents" && (
                    <>
                      <Text style={styles.docLine}><Text style={styles.k}>reporter: </Text>{doc.citizen_name}</Text>
                      <Text style={styles.docLine}><Text style={styles.k}>severity: </Text>{doc.final_severity}  •  <Text style={styles.k}>status: </Text>{doc.status}</Text>
                      <Text style={styles.docLine}><Text style={styles.k}>dispatch: </Text>{(doc.recommended_services || []).join(", ")}</Text>
                      {doc.ai_analysis && <Text style={styles.docLine}><Text style={styles.k}>ai: </Text>{doc.ai_analysis.incident_type} ({Math.round((doc.ai_analysis.confidence || 0) * 100)}%)</Text>}
                      <Text style={styles.docLine}><Text style={styles.k}>loc: </Text>{doc.latitude?.toFixed(4)}, {doc.longitude?.toFixed(4)}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  topTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  docsBanner: { backgroundColor: COLORS.brand, padding: 18, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  docsTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  docsSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  collCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  collHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  collTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: COLORS.text },
  countPill: { backgroundColor: COLORS.brand, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  collSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  docCard: { backgroundColor: COLORS.bg, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  docKey: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, marginBottom: 4, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  docLine: { fontSize: 12, color: COLORS.text, marginTop: 2 },
  k: { color: COLORS.textSecondary, fontWeight: "700" },
});
