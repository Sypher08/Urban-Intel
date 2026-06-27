import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAuth, apiFetch } from "@/src/context/AuthContext";
import { COLORS, SEVERITY_COLOR } from "@/src/theme";

type Severity = "Low" | "Medium" | "High";
type Service = "Ambulance" | "Fire" | "Police";

export default function Report() {
  const router = useRouter();
  const { token } = useAuth();
  const { sos } = useLocalSearchParams<{ sos?: string }>();
  const isSOS = sos === "1";

  const [imageB64, setImageB64] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>(isSOS ? "High" : "Medium");
  const [service, setService] = useState<Service>("Ambulance");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ai, setAi] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          // fallback to NYC
          setCoords({ lat: 40.7128, lng: -74.006 });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setCoords({ lat: 40.7128, lng: -74.006 });
      }
    })();
    if (isSOS) {
      (async () => {
        try {
          const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.4, allowsEditing: false }).catch(() => null);
          if (r && !r.canceled && r.assets[0]?.base64) {
            setImageB64(r.assets[0].base64);
          }
        } catch {}
      })();
    }
  }, [isSOS]);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access in Settings.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]?.base64) {
      setImageB64(result.assets[0].base64);
      setAi(null);
    }
  };

  const runAI = async () => {
    if (!imageB64) {
      Alert.alert("No photo", "Please attach a photo first.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await apiFetch("/incidents/analyze", {
        method: "POST",
        body: JSON.stringify({ image_base64: imageB64, service }),
      }, token);
      setAi(res);
      if (res.ai_severity) setSeverity(res.ai_severity);
    } catch (e: any) {
      Alert.alert("AI failed", e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    if (!coords) { Alert.alert("No location", "Waiting for GPS..."); return; }
    if (!isSOS && !description.trim()) { Alert.alert("Missing", "Please add a description"); return; }
    setSubmitting(true);
    try {
      const incident = await apiFetch("/incidents", {
        method: "POST",
        body: JSON.stringify({
          description: description || (isSOS ? "SOS — immediate assistance needed." : ""),
          severity, service,
          latitude: coords.lat, longitude: coords.lng,
          image_base64: imageB64,
          is_sos: isSOS,
        }),
      }, token);
      router.replace({ pathname: "/(citizen)/incident/[id]", params: { id: incident.id } });
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="report-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isSOS ? "SOS Alert" : "Report Incident"}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo */}
        <Text style={styles.label}>EVIDENCE PHOTO</Text>
        {imageB64 ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: `data:image/jpeg;base64,${imageB64}` }} style={styles.photo} />
            <TouchableOpacity testID="photo-remove" style={styles.photoX} onPress={() => { setImageB64(null); setAi(null); }}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActions}>
            <TouchableOpacity testID="pick-camera" style={styles.photoBtn} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={28} color={COLORS.brand} />
              <Text style={styles.photoBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="pick-gallery" style={styles.photoBtn} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={28} color={COLORS.brand} />
              <Text style={styles.photoBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {imageB64 && (
          <TouchableOpacity testID="run-ai" style={styles.aiBtn} onPress={runAI} disabled={aiLoading}>
            {aiLoading ? <ActivityIndicator color={COLORS.brand} /> : (
              <>
                <Ionicons name="sparkles" size={18} color={COLORS.brand} />
                <Text style={styles.aiBtnText}>{ai ? "Re-run AI Triage" : "Run AI Triage"}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {ai && (
          <View testID="ai-result" style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={18} color={COLORS.brand} />
              <Text style={styles.aiTitle}>AI Triage</Text>
              <View style={[styles.confPill, { backgroundColor: COLORS.brand }]}>
                <Text style={styles.confText}>{Math.round((ai.confidence || 0) * 100)}%</Text>
              </View>
            </View>
            <Text style={styles.aiRow}><Text style={styles.aiK}>Type: </Text>{ai.incident_type}</Text>
            <Text style={styles.aiRow}><Text style={styles.aiK}>Severity: </Text>{ai.ai_severity}</Text>
            <Text style={styles.aiRow}><Text style={styles.aiK}>Dispatch: </Text>{(ai.recommended_services || []).join(", ")}</Text>
            <Text style={styles.aiReason}>{ai.reasoning}</Text>
            {ai.mismatch_warning && (
              <View style={styles.mismatch}><Ionicons name="warning" size={14} color="#92400E" /><Text style={styles.mismatchText}>{ai.mismatch_warning}</Text></View>
            )}
          </View>
        )}

        {/* Severity */}
        <Text style={styles.label}>SEVERITY</Text>
        <View style={styles.row}>
          {(["Low", "Medium", "High"] as Severity[]).map((s) => {
            const c = SEVERITY_COLOR[s];
            const active = severity === s;
            return (
              <TouchableOpacity key={s} testID={`sev-${s}`} style={[styles.pill, active && { backgroundColor: c.bg, borderColor: c.fg }]} onPress={() => setSeverity(s)}>
                <Text style={[styles.pillText, active && { color: c.fg, fontWeight: "800" }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Service */}
        <Text style={styles.label}>SERVICE NEEDED</Text>
        <View style={styles.row}>
          {(["Ambulance", "Fire", "Police"] as Service[]).map((s) => {
            const active = service === s;
            const icon = s === "Ambulance" ? "medkit" : s === "Fire" ? "flame" : "shield-checkmark";
            return (
              <TouchableOpacity key={s} testID={`svc-${s}`} style={[styles.pill, active && { backgroundColor: COLORS.brand, borderColor: COLORS.brand }]} onPress={() => setService(s)}>
                <Ionicons name={icon as any} size={16} color={active ? "#fff" : COLORS.text} />
                <Text style={[styles.pillText, { marginLeft: 6 }, active && { color: "#fff", fontWeight: "800" }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          testID="report-desc"
          style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder={isSOS ? "Optional details..." : "Describe what's happening..."}
          placeholderTextColor={COLORS.textMuted}
        />

        {/* Location */}
        <View style={styles.locCard}>
          <Ionicons name="location" size={20} color={COLORS.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>GPS Location</Text>
            <Text style={styles.locVal}>{coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Acquiring..."}</Text>
          </View>
        </View>

        <TouchableOpacity testID="submit-report" style={[styles.submit, isSOS && { backgroundColor: COLORS.critical }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name={isSOS ? "warning" : "paper-plane"} size={18} color="#fff" />
              <Text style={styles.submitText}>{isSOS ? "Send SOS Now" : "Send Report"}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  topTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginTop: 20, marginBottom: 10 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text },
  row: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", flexDirection: "row", backgroundColor: COLORS.surface },
  pillText: { fontSize: 14, color: COLORS.text },
  photoActions: { flexDirection: "row", gap: 12 },
  photoBtn: { flex: 1, height: 130, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  photoBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  photoWrap: { position: "relative", borderRadius: 16, overflow: "hidden" },
  photo: { width: "100%", height: 220 },
  photoX: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.6)", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  aiBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.surface },
  aiBtnText: { color: COLORS.brand, fontWeight: "700" },
  aiCard: { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  aiTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text },
  confPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  confText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  aiRow: { fontSize: 13, color: COLORS.text, marginTop: 4 },
  aiK: { color: COLORS.textSecondary, fontWeight: "700" },
  aiReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, fontStyle: "italic" },
  mismatch: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.warningLight, padding: 10, borderRadius: 10 },
  mismatchText: { color: "#92400E", fontSize: 12, flex: 1 },
  locCard: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  locTitle: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.5 },
  locVal: { fontSize: 14, color: COLORS.text, fontWeight: "600", marginTop: 2 },
  submit: { marginTop: 24, backgroundColor: COLORS.brand, paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
});
