import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, Role } from "@/src/context/AuthContext";
import { COLORS } from "@/src/theme";

type AgencyType = "Ambulance" | "Fire" | "Police";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("citizen");
  const [agencyType, setAgencyType] = useState<AgencyType>("Ambulance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null); setSuccess(null);
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const u = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        role,
        agency_type: role === "agency" ? agencyType : undefined,
      });
      setSuccess(`Welcome, ${u.name}! Redirecting…`);
      setTimeout(() => router.replace(u.role === "citizen" ? "/(citizen)/home" : "/(agency)/dashboard"), 600);
    } catch (e: any) {
      const msg = e?.message || "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="register-back">
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.h1}>Create account</Text>
          <Text style={styles.sub}>Join Urban Intel to report or respond to emergencies.</Text>

          {error && (
            <View style={styles.errBox} testID="register-error">
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.errText}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={styles.okBox} testID="register-success">
              <Ionicons name="checkmark-circle" size={18} color="#047857" />
              <Text style={styles.okText}>{success}</Text>
            </View>
          )}

          <Text style={styles.label}>I AM A</Text>
          <View style={styles.roleRow}>
            {(["citizen", "agency", "admin"] as Role[]).map((r) => (
              <TouchableOpacity
                key={r}
                testID={`role-${r}`}
                onPress={() => setRole(r)}
                style={[styles.rolePill, role === r && styles.rolePillActive]}
              >
                <Text style={[styles.rolePillText, role === r && styles.rolePillTextActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {role === "agency" && (
            <>
              <Text style={styles.label}>AGENCY TYPE</Text>
              <View style={styles.roleRow}>
                {(["Ambulance", "Fire", "Police"] as AgencyType[]).map((a) => (
                  <TouchableOpacity
                    key={a}
                    testID={`agency-${a}`}
                    onPress={() => setAgencyType(a)}
                    style={[styles.rolePill, agencyType === a && styles.rolePillActive]}
                  >
                    <Text style={[styles.rolePillText, agencyType === a && styles.rolePillTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>FULL NAME</Text>
          <TextInput testID="reg-name" style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput testID="reg-email" style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.label}>PHONE (OPTIONAL)</Text>
          <TextInput testID="reg-phone" style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="+1 555 123 4567" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput testID="reg-password" style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="6+ characters" placeholderTextColor={COLORS.textMuted} />

          <TouchableOpacity testID="reg-submit" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
          </TouchableOpacity>

          <Link href="/auth/login" asChild>
            <TouchableOpacity testID="goto-login">
              <Text style={styles.linkText}>Already have an account? <Text style={{ fontWeight: "700" }}>Sign In</Text></Text>
            </TouchableOpacity>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, paddingBottom: 48 },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center", marginBottom: 8 },
  h1: { fontSize: 32, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, marginBottom: 16 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.criticalLight, padding: 12, borderRadius: 12, marginTop: 8 },
  errText: { color: "#B91C1C", flex: 1, fontSize: 13, fontWeight: "600" },
  okBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.successLight, padding: 12, borderRadius: 12, marginTop: 8 },
  okText: { color: "#047857", flex: 1, fontSize: 13, fontWeight: "600" },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text },
  roleRow: { flexDirection: "row", gap: 8 },
  rolePill: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", backgroundColor: COLORS.surface },
  rolePillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  rolePillText: { fontWeight: "600", color: COLORS.textSecondary, fontSize: 13 },
  rolePillTextActive: { color: "#fff" },
  primaryBtn: { backgroundColor: COLORS.brand, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  linkText: { textAlign: "center", marginTop: 18, color: COLORS.textSecondary, fontSize: 14 },
});
