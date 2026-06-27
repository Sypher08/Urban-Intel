import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";

export type Role = "citizen" | "agency" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  agency_type?: "Ambulance" | "Fire" | "Police" | null;
  reputation: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (params: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: Role;
    agency_type?: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = "ui_token";
const USER_KEY = "ui_user";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export async function apiFetch(path: string, options: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet(TOKEN_KEY, "");
      const u = await storage.getItem(USER_KEY, "");
      if (t && typeof t === "string") {
        setToken(t);
        if (u && typeof u === "string") {
          try { setUser(JSON.parse(u)); } catch {}
        }
        try {
          const me = await apiFetch("/auth/me", { method: "GET" }, t);
          setUser(me);
          await storage.setItem(USER_KEY, JSON.stringify(me));
        } catch {
          await storage.secureRemove(TOKEN_KEY);
          await storage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    setUser(data.user);
    await storage.secureSet(TOKEN_KEY, data.access_token);
    await storage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  };

  const register = async (params: { name: string; email: string; password: string; phone?: string; role: Role; agency_type?: string }) => {
    const body: any = {
      name: params.name,
      email: params.email,
      password: params.password,
      role: params.role,
    };
    if (params.phone) body.phone = params.phone;
    if (params.agency_type) body.agency_type = params.agency_type;
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.access_token);
    setUser(data.user);
    await storage.secureSet(TOKEN_KEY, data.access_token);
    await storage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  };

  const signOut = async () => {
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
