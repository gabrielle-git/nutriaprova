/**
 * Base URL pública do app (confirmação de e-mail, recovery, OAuth redirect).
 * Defina `VITE_SITE_URL=https://seu-dominio.com` no build; senão usa `window.location.origin`.
 */
export function getSiteOrigin(): string {
  const raw = import.meta.env.VITE_SITE_URL;
  if (typeof raw === "string" && raw.trim()) {
    return raw.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function authCallbackUrl(): string {
  return `${getSiteOrigin()}/auth/callback`;
}

export function passwordResetRedirectUrl(): string {
  return `${getSiteOrigin()}/reset-password`;
}
