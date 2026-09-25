import { supabase } from "@/integrations/supabase/client";

export async function ensureTrialCredits() {
  const { data, error } = await supabase.rpc("ensure_trial_credits");
  if (error) throw error;
  return data;
}

export async function consumeJobCredit(requestId: string) {
  const { data, error } = await supabase.rpc("consume_job_credit", {
    request_id: requestId,
  });
  if (error) throw error;
  return data as {
    ok?: boolean;
    cost?: number;
    credits?: number;
    plan_tier?: string;
  } | null;
}

export async function adminAdjustCredits(
  targetUserId: string,
  delta: number,
  reason: string,
) {
  const { data, error } = await supabase.rpc("admin_adjust_credits", {
    target_user_id: targetUserId,
    delta,
    reason,
  });
  if (error) throw error;
  return data;
}

export async function downgradeOwnPlanToFreemium() {
  const { data, error } = await supabase.rpc("downgrade_own_plan_to_freemium");
  if (error) throw error;
  return data;
}

export async function activatePlanWithInternalBalance(
  targetTier: "basic" | "premium" | "clinic",
  billingPeriod: "monthly" | "annual" = "monthly",
) {
  const { data, error } = await supabase.rpc("activate_plan_with_internal_balance", {
    target_tier: targetTier,
    billing_period: billingPeriod,
  });
  if (error) throw error;
  return data as {
    status: "activated" | "payment_required";
    reason?: string;
    required?: number;
    available?: number;
    plan_tier?: string;
    credits?: number;
    debited?: number;
    grant?: number;
  } | null;
}
