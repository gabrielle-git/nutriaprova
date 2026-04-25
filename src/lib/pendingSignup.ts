/**
 * Persistência da intenção de cadastro antes do redirect OAuth (Google).
 *
 * Motivo: `supabase.auth.signInWithOAuth(...)` ignora `options.data`; o role
 * escolhido na tela de cadastro era perdido ao voltar do Google, fazendo o
 * trigger `handle_new_user` criar o profile com o padrão `client`.
 *
 * Gravamos a intenção aqui no localStorage antes do redirect e reconciliamos
 * em `/auth/callback` assim que a sessão estiver confirmada.
 */

const KEY = "nutriaprova:pendingSignup";

export type PendingRole = "client" | "nutritionist" | "personal_trainer";

export type PendingSignup = {
  role: PendingRole;
  fullName?: string;
  crnNumber?: string | null;
  refCode?: string | null;
};

export function setPendingSignup(data: PendingSignup): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage indisponível (modo privado, etc.) → seguimos sem persistir
  }
}

export function getPendingSignup(): PendingSignup | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (!parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
