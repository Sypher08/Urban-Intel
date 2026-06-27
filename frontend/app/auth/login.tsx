import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Enter email and password");
      return;
    }
    setLoading(true);
    try {
      const u = await signIn(email.trim().toLowerCase(), password);
      router.replace(u.role === "citizen" ? "/(citizen)/home" : "/(agency)/dashboard");
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const useDemo = (em: string, pw: string) => {
    setEmail(em); setPassword(pw);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Ionicons name="shield-checkmark" size={28} color="#fff" />
            </View>
            <View>
              <Text style={styles.brandName}>URBAN INTEL</Text>
              <Text style={styles.brandTag}>Emergency Response Platform</Text>
            </View>
          </View>

          <Text style={styles.h1}>Sign in</Text>
          <Text style={styles.sub}>Report incidents. Save lives.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              testID="login-password"
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
            />

            <TouchableOpacity testID="login-submit" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <Link href="/auth/register" asChild>
              <TouchableOpacity testID="goto-register">
                <Text style={styles.linkText}>Don&apos;t have an account? <Text style={{ fontWeight: "700" }}>Register</Text></Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Try a demo account</Text>
            <TouchableOpacity testID="demo-citizen" style={styles.demoRow} onPress={() => useDemo("citizen@urbanintel.app", "Citizen@123")}>
              <Ionicons name="person" size={18} color={COLORS.info} />
              <Text style={styles.demoText}>Citizen</Text>
              <Text style={styles.demoEmail}>citizen@urbanintel.app</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="demo-admin" style={styles.demoRow} onPress={() => useDemo("admin@urbanintel.app", "Admin@123")}>
              <Ionicons name="shield" size={18} color={COLORS.brand} />
              <Text style={styles.demoText}>Admin</Text>
              <Text style={styles.demoEmail}>admin@urbanintel.app</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="demo-fire" style={styles.demoRow} onPress={() => useDemo("fire@urbanintel.app", "Fire@123")}>
              <Ionicons name="flame" size={18} color={COLORS.critical} />
              <Text style={styles.demoText}>Fire Dispatch</Text>
              <Text style={styles.demoEmail}>fire@urbanintel.app</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, paddingBottom: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 32 },
  logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: COLORS.text },
  brandTag: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  h1: { fontSize: 34, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: COLORS.textSecondary, marginTop: 6, marginBottom: 28 },
  form: { gap: 6 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginTop: 14, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text,
  },
  primaryBtn: {
    backgroundColor: COLORS.brand, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 24,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  linkText: { textAlign: "center", marginTop: 18, color: COLORS.textSecondary, fontSize: 14 },
  demoBox: { marginTop: 32, padding: 16, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  demoTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 12 },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  demoText: { fontSize: 14, fontWeight: "600", color: COLORS.text, width: 110 },
  demoEmail: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
});
