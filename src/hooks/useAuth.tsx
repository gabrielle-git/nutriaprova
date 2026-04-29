import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authCallbackUrl } from "@/lib/siteUrl";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: "client" | "nutritionist" | "personal_trainer" | "admin";
  credits: number;
  crn_number: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
  affiliate_code: string | null;
  referred_by: string | null;
  /** Plano de assinatura (coluna `plan_tier` no banco). */
  plan_tier?: string;
  /** URL pública (storage) da foto de perfil */
  avatar_url?: string | null;
  /** URL pública da logomarca usada no white-label dos PDFs */
  clinic_logo_url?: string | null;
  /** Alias legado para integração com payloads de PDF */
  logo_url?: string | null;
  /** Coluna DATE no Postgres (YYYY-MM-DD) */
  birth_date?: string | null;
  /** Snapshot JSON do questionário / dados do cliente */
  client_data?: Record<string, unknown> | null;
}

interface AuthContextType {
  user:           User | null;
  session:        Session | null;
  profile:        Profile | null;
  loading:        boolean;
  signUp:         (email: string, password: string, fullName: string, role: "client" | "nutritionist" | "personal_trainer", crnNumber?: string) => Promise<void>;
  signIn:         (email: string, password: string) => Promise<void>;
  signOut:        () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[useAuth] profile fetch:", error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    if (next?.user) {
      setProfile(await loadProfile(next.user.id));
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Sessão inicial + listener de mudanças em uma única rotina.
    supabase.auth.getSession().then(async ({ data: { session: initial } }) => {
      if (!active) return;
      await applySession(initial);
      if (active) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      void applySession(next);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfile(await loadProfile(user.id));
  }, [user]);

  const signUp: AuthContextType["signUp"] = async (email, password, fullName, role, crnNumber) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, crn_number: crnNumber ?? null },
        emailRedirectTo: authCallbackUrl(),
      },
    });
    if (error) throw error;
  };

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut: AuthContextType["signOut"] = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
