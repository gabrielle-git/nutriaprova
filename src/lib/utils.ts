import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Texto de perfil exibido no byline de artigos (blog / aprovação). */
export function blogAuthorBylineFromProfile(
  p: { full_name?: string | null; role?: string | null; crn_number?: string | null } | null | undefined
): { author_display_name: string | null; author_role_label: string | null } {
  const name = (p?.full_name ?? "").trim() || null;
  let roleLabel: string | null = null;
  const r = p?.role;
  if (r === "nutritionist") {
    roleLabel = p?.crn_number ? `Nutricionista • CRN ${p.crn_number}` : "Nutricionista";
  } else if (r === "personal_trainer") {
    roleLabel = "Personal Trainer";
  } else if (r === "admin") {
    roleLabel = "Equipe nutriAprova";
  }
  return { author_display_name: name, author_role_label: roleLabel };
}
