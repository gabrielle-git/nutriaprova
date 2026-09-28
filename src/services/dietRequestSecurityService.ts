import { supabase } from "@/integrations/supabase/client";

export type ClaimDietRequestStatus =
  | "claimed"
  | "already_owned"
  | "already_claimed"
  | "not_eligible"
  | "not_approved"
  | "not_found"
  | "insufficient_credits";

export interface ClaimDietRequestResult {
  status: ClaimDietRequestStatus;
  reason?: "role" | "assigned_to_other" | "status";
  request_id?: string;
  request_status?: string;
  cost?: number;
  credits?: number;
}

/**
 * Claim atômico via RPC `claim_diet_request` (1E.2B). A identidade do
 * nutricionista é derivada de auth.uid() no servidor; pending → in_review
 * debita via consume_job_credit na mesma transação.
 */
export async function claimDietRequest(requestId: string): Promise<ClaimDietRequestResult> {
  // `claim_diet_request` ainda não está em types.ts (regeneração local diverge além do escopo).
  const rpc = supabase.rpc as unknown as (
    fn: "claim_diet_request",
    args: { p_request_id: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc.call(supabase, "claim_diet_request", { p_request_id: requestId });
  if (error) throw error;
  return data as ClaimDietRequestResult;
}
