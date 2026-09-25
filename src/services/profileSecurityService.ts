import { supabase } from "@/integrations/supabase/client";

export type PublicRole = "client" | "nutritionist" | "personal_trainer";

/** Role público válido para signup/transição — nunca admin. */
export function sanitizePublicRole(
  role: string | null | undefined,
): PublicRole {
  if (role === "nutritionist") return "nutritionist";
  if (role === "personal_trainer") return "personal_trainer";
  return "client";
}

export async function requestOwnRoleTransition(
  targetRole: PublicRole,
  crnNumber?: string | null,
) {
  const { data, error } = await supabase.rpc("request_own_role_transition", {
    target_role: targetRole,
    p_crn_number: crnNumber ?? null,
  });
  if (error) throw error;
  return data;
}

export async function adminSetProfessionalApproval(
  targetUserId: string,
  approved: boolean,
) {
  const { data, error } = await supabase.rpc("admin_set_professional_approval", {
    target_user_id: targetUserId,
    p_approved: approved,
  });
  if (error) throw error;
  return data;
}

/** Aguarda o profile criado pelo trigger handle_new_user (bounded). */
export async function waitForOwnProfile(
  userId: string,
  attempts = 8,
  delayMs = 150,
) {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, crn_number, referred_by, approved, phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}
