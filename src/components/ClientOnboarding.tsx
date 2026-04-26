import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Sparkles, Lock, Check, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateDietPlan, type ClientData, type DietPlan } from "@/services/n8nService";
import { toast } from "sonner";
import DietPlanCard from "./DietPlanCard";
import PremiumDietPlanView from "./PremiumDietPlanView";
import ClientCompletedDiet from "./ClientCompletedDiet";
import RecompraCard from "./RecompraCard";
import CheckoutModal from "./CheckoutModal";

const GOAL_OPTIONS = [
  { value: "perder_peso", label: "Perda de Peso", emoji: "🏃" },
  { value: "ganhar_massa", label: "Ganho de Massa Muscular", emoji: "💪" },
  { value: "reeducacao", label: "Reeducação Alimentar", emoji: "🥗" },
  { value: "diabetes", label: "Controle de Diabetes", emoji: "🩺" },
  { value: "performance", label: "Performance Esportiva", emoji: "⚡" },
  { value: "longevidade", label: "Longevidade", emoji: "🧬" },
];

const ALLERGY_OPTIONS = [
  { value: "gluten", label: "Sem Glúten", emoji: "🌾" },
  { value: "lactose", label: "Zero Lactose", emoji: "🥛" },
  { value: "amendoim", label: "Amendoim", emoji: "🥜" },
  { value: "frutos_do_mar", label: "Frutos do Mar", emoji: "🦐" },
  { value: "ovo", label: "Ovo", emoji: "🥚" },
  { value: "soja", label: "Soja", emoji: "🫘" },
  { value: "vegano", label: "Vegano", emoji: "🌱" },
  { value: "vegetariano", label: "Vegetariano", emoji: "🥬" },
];

const STEPS = ["Dados Básicos", "Objetivos", "Restrições", "Gerando..."];

type ClientOnboardingForm = Omit<ClientData, "gender" | "weight" | "height"> & {
  gender: ClientData["gender"] | "";
  weight: number | "";
  height: number | "";
};

const EMPTY_FORM: ClientOnboardingForm = {
  age: 0,
  birthDate: "",
  gender: "",
  weight: "",
  height: "",
  goal: "",
  allergies: [],
  activityLevel: "moderate",
  additionalNotes: "",
};

const isFilled = (value: unknown) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  !(Array.isArray(value) && value.length === 0);

const coerceNumber = (value: unknown): number | "" => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return "";
};

const parseGoalValues = (goal: unknown): string[] => {
  if (Array.isArray(goal)) return goal.filter((item): item is string => typeof item === "string");
  if (typeof goal !== "string") return [];
  return goal
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const mergeClientData = (
  primary: Record<string, any> | null | undefined,
  fallback: Record<string, any> | null | undefined,
) => {
  const read = (key: string) => (isFilled(primary?.[key]) ? primary?.[key] : fallback?.[key]);
  return {
    age: read("age"),
    birthDate: read("birthDate"),
    gender: read("gender"),
    weight: read("weight"),
    height: read("height"),
    goal: read("goal"),
    allergies: read("allergies"),
    activityLevel: read("activityLevel"),
    additionalNotes: read("additionalNotes"),
  };
};

export default function ClientOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [dietRequestId, setDietRequestId] = useState<string | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  // Observação: `gender` começa vazio e é narrowed para
  // "masculino" | "feminino" apenas após validação (ver guard em handleGenerate).
  const [formData, setFormData] = useState<ClientOnboardingForm>(EMPTY_FORM);

  const calculateAge = (dateStr: string) => {
    if (!dateStr) return 0;
    const today = new Date();
    const birth = new Date(dateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const hydrateFromDatabase = async () => {
      const [profileRes, latestRequestRes] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("client_data, birth_date, allergies, goals")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("diet_requests")
          .select("client_data")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        console.warn("[ClientOnboarding] profiles hydration:", profileRes.error.message);
      }
      if (latestRequestRes.error) {
        console.warn("[ClientOnboarding] diet_requests hydration:", latestRequestRes.error.message);
      }

      const profileRow = profileRes.data as any | null;
      const profileClientData = (profileRow?.client_data ?? {}) as Record<string, any>;
      const latestClientData = ((latestRequestRes.data as any)?.client_data ?? {}) as Record<string, any>;
      const hydrated = mergeClientData(profileClientData, latestClientData);
      const birthDate = (hydrated.birthDate || profileRow?.birth_date || "") as string;
      const goals = parseGoalValues(hydrated.goal || profileRow?.goals);
      const allergies = Array.isArray(hydrated.allergies)
        ? hydrated.allergies
        : typeof profileRow?.allergies === "string"
        ? profileRow.allergies.split(",").map((item: string) => item.trim()).filter(Boolean)
        : [];

      setFormData({
        ...EMPTY_FORM,
        age: birthDate ? calculateAge(birthDate) : 0,
        birthDate,
        gender:
          hydrated.gender === "masculino" || hydrated.gender === "feminino"
            ? hydrated.gender
            : "",
        weight: coerceNumber(hydrated.weight),
        height: coerceNumber(hydrated.height),
        goal: goals.join(", "),
        allergies,
        activityLevel:
          typeof hydrated.activityLevel === "string" && hydrated.activityLevel
            ? hydrated.activityLevel
            : "moderate",
        additionalNotes:
          typeof hydrated.additionalNotes === "string" ? hydrated.additionalNotes : "",
      });
      setSelectedGoals(goals);
    };

    void hydrateFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleAllergy = (allergy: string) => {
    const current = formData.allergies;
    setFormData({
      ...formData,
      allergies: current.includes(allergy)
        ? current.filter((a) => a !== allergy)
        : [...current, allergy],
    });
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente para gerar seu plano.");
      return;
    }

    // Guard: exige dados mínimos para evitar chamadas ao n8n com payload vazio
    // (causa raiz de loops/500 no Supabase quando ai_draft vem inválido).
    // Gênero é obrigatório porque impacta diretamente o cálculo calórico da IA.
    if (
      !formData.birthDate ||
      !formData.weight ||
      !formData.height ||
      !formData.gender ||
      selectedGoals.length === 0
    ) {
      toast.error("Preencha todos os campos obrigatórios (incluindo gênero) antes de gerar o plano.");
      setStep(0);
      return;
    }

    setStep(3);
    setGenerating(true);
    // Narrow do gender: já validado pelo guard acima, portanto podemos afirmar
    // que é "masculino" | "feminino" e casar com o tipo ClientData exigido pela IA.
    const dataToSend: ClientData = {
      ...formData,
      age: calculateAge(formData.birthDate),
      gender: formData.gender as "masculino" | "feminino",
      weight: Number(formData.weight),
      height: Number(formData.height),
      goal: selectedGoals.join(", "),
    };

    try {
      // 1) Registra a tentativa imediatamente no funil para recuperação de carrinho.
      const { data: createdRequest, error: createError } = await supabase
        .from("diet_requests")
        .insert({
          client_id: user.id,
          client_data: dataToSend as any,
          status: "awaiting_payment",
          notes: "Questionário enviado. Aguardando processamento da IA.",
        } as any)
        .select("id")
        .single();

      if (createError || !createdRequest?.id) {
        console.error("[handleGenerate] create diet_request falhou:", createError);
        toast.error("Não foi possível iniciar seu plano. Tente novamente.");
        setStep(2);
        return;
      }

      const requestId = String(createdRequest.id);
      setDietRequestId(requestId);

      // 2) Chamada à IA via n8n — protegida por try/catch dedicado para que
      //    uma falha de rede/timeout não quebre a árvore de componentes.
      let plan: DietPlan;
      try {
        plan = await generateDietPlan(dataToSend);
      } catch (aiError: any) {
        // Mensagem técnica (ex: "Failed to fetch") permanece apenas no console
        // para debug — o usuário final vê sempre um texto amigável e estável.
        console.error("[handleGenerate] n8nService falhou:", aiError);
        toast.error(
          "Sistema indisponível: Não foi possível gerar o plano no momento. Tente novamente.",
        );
        await supabase
          .from("diet_requests")
          .update({
            notes: "Falha ao gerar dieta via IA. Tentar novamente.",
          } as any)
          .eq("id", requestId);
        setStep(2);
        return;
      }

      // 3) Atualiza o registro já criado com o plano pronto para paywall.
      try {
        const { data: myProfile } = await (supabase as any)
          .from("profiles")
          .select("referred_by, client_data")
          .eq("user_id", user.id)
          .maybeSingle();
        const assigned = (myProfile as any)?.referred_by ?? null;
        const { error: updateRequestError } = await supabase
          .from("diet_requests")
          .update({
            ai_draft: plan as any,
            assigned_nutritionist_id: assigned,
            notes: "Plano gerado. Aguardando pagamento para desbloqueio.",
          } as any)
          .eq("id", requestId);

        if (updateRequestError) {
          console.error("[handleGenerate] diet_requests update error:", updateRequestError);
          toast.error("Plano gerado, mas houve erro ao salvar. Tente novamente.");
        }

        const previousClientData = ((myProfile as any)?.client_data ?? {}) as Record<string, any>;
        const { error: profileError } = await (supabase as any)
          .from("profiles")
          .update({
            birth_date: dataToSend.birthDate,
            client_data: {
              ...previousClientData,
              ...dataToSend,
            },
          })
          .eq("user_id", user.id);

        if (profileError) {
          console.warn("[handleGenerate] profiles client_data update:", profileError.message);
        }
        toast.success("Plano gerado! Desbloqueie para continuar.");
      } catch (dbError: any) {
        console.error("[handleGenerate] Supabase falhou:", dbError);
        toast.error("Plano gerado, mas não conseguimos salvar. Tente novamente.");
      }

      setDietPlan(plan);
    } catch (err: any) {
      // Safety net — qualquer erro inesperado cai aqui e vira toast vermelho
      // em vez de quebrar a tela inteira. Nunca vazamos a mensagem crua do
      // browser/JS para o usuário final (evita textos como "Failed to fetch").
      console.error("[handleGenerate] erro inesperado:", err);
      toast.error(
        "Sistema indisponível: Não foi possível gerar o plano no momento. Tente novamente.",
      );
      setStep(2);
    } finally {
      setGenerating(false);
    }
  };

  const canProceed = () => {
    if (step === 0) {
      return (
        !!formData.birthDate &&
        formData.birthDate.length > 0 &&
        formData.weight > 0 &&
        formData.height > 0 &&
        !!formData.gender
      );
    }
    if (step === 1) return selectedGoals.length > 0;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* DietProgressTracker é renderizado pelo ClientDashboard (parent).
          Evitamos duplicar para não colidir o channel Realtime. */}

      {/* Completed Diets with Feedback */}
      <ClientCompletedDiet />

      {/* Re-engagement / Recompra CTA */}
      <RecompraCard />

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.slice(0, 3).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary text-primary-foreground pulse-emerald" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < 2 && <div className={`w-12 h-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Seus Dados Básicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input
                      type="date"
                      value={formData.birthDate || ""}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setFormData({
                        ...formData,
                        birthDate: e.target.value,
                        age: calculateAge(e.target.value),
                      })}
                    />
                    {formData.birthDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculateAge(formData.birthDate)} anos
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Peso (kg)</Label>
                      <Input
                        type="number"
                        value={formData.weight}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            weight: e.target.value === "" ? "" : +e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Altura (cm)</Label>
                      <Input
                        type="number"
                        value={formData.height}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            height: e.target.value === "" ? "" : +e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Gênero — obrigatório para o cálculo calórico basal (TMB)
                      da IA. Fator Mifflin-St Jeor difere em ~166 kcal/dia entre sexos. */}
                  <div>
                    <Label>
                      Gênero <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      {[
                        { value: "masculino" as const, label: "Masculino", emoji: "👨" },
                        { value: "feminino" as const, label: "Feminino", emoji: "👩" },
                      ].map((opt) => {
                        const selected = formData.gender === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, gender: opt.value })}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                              selected
                                ? "border-primary bg-accent"
                                : "border-border hover:border-primary/50"
                            }`}
                            aria-pressed={selected}
                          >
                            <span className="text-xl" aria-hidden>
                              {opt.emoji}
                            </span>
                            <span className="font-medium text-sm">{opt.label}</span>
                            {selected && <Check className="h-4 w-4 text-primary ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Essencial para o cálculo calórico correto do seu plano.
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Nível de Atividade</Label>
                  <Select value={formData.activityLevel} onValueChange={(v) => setFormData({ ...formData, activityLevel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentário</SelectItem>
                      <SelectItem value="light">Leve</SelectItem>
                      <SelectItem value="moderate">Moderado</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="very_active">Muito Ativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setStep(1)} disabled={!canProceed()} className="w-full">
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Quais são seus objetivos?</CardTitle>
                <p className="text-sm text-muted-foreground">Selecione um ou mais objetivos</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {GOAL_OPTIONS.map((goal) => (
                    <button
                      key={goal.value}
                      onClick={() => toggleGoal(goal.value)}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        selectedGoals.includes(goal.value)
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="text-2xl">{goal.emoji}</span>
                      <span className="font-medium text-sm">{goal.label}</span>
                      {selectedGoals.includes(goal.value) && (
                        <Check className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={!canProceed()} className="flex-1">
                    Próximo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Alergias e Restrições Alimentares</CardTitle>
                <p className="text-sm text-muted-foreground">Selecione todas que se aplicam (opcional)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {ALLERGY_OPTIONS.map((allergy) => (
                    <button
                      key={allergy.value}
                      onClick={() => toggleAllergy(allergy.label)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        formData.allergies.includes(allergy.label)
                          ? "border-destructive/60 bg-destructive/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="text-lg">{allergy.emoji}</span>
                      <span className="font-medium text-sm">{allergy.label}</span>
                      {formData.allergies.includes(allergy.label) && (
                        <Check className="h-4 w-4 text-destructive ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <div>
                  <Label htmlFor="additionalNotes">Descreva melhor seu foco, rotina ou metas específicas (Opcional)</Label>
                  <Textarea
                    id="additionalNotes"
                    placeholder="Ex: Treino musculação 5x por semana, trabalho noturno, prefiro refeições rápidas..."
                    value={formData.additionalNotes || ""}
                    onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                    className="mt-1"
                    rows={4}
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={handleGenerate} className="flex-1 emerald-gradient text-primary-foreground">
                    <Sparkles className="mr-2 h-4 w-4" /> Gerar Meu Plano
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {generating ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-2">Gerando seu plano...</h2>
                <p className="text-muted-foreground">Nossa IA está processando seus dados...</p>
                <div className="mt-6 w-64 mx-auto h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full emerald-gradient rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                  />
                </div>
              </div>
            ) : dietPlan ? (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Seu Plano Alimentar
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{dietPlan.totalCalories} kcal/dia</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Header */}
                  <div className="rounded-lg border border-primary/30 bg-accent/40 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Shield className="h-5 w-5 text-primary" />
                      <p className="font-display font-semibold text-sm">Estamos aguardando a validação de um profissional registrado para sua total segurança.</p>
                    </div>
                  </div>

                   {/* Blurred preview using PremiumDietPlanView for consistency */}
                   <div className="relative">
                     <div className="filter blur-sm select-none pointer-events-none max-h-[600px] overflow-hidden">
                       <PremiumDietPlanView plan={dietPlan} isCompleted={false} />
                     </div>
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                       <Lock className="h-8 w-8 text-primary mb-3" />
                       <p className="font-display font-semibold text-lg mb-1">Seu plano de alta performance está pronto e guardado.</p>
                       <p className="text-sm text-muted-foreground mb-4">Desbloqueie agora para começar sua transformação.</p>
                       <Button
                         onClick={() => setCheckoutOpen(true)}
                         className="emerald-gradient text-primary-foreground text-base px-6 py-3 h-auto"
                       >
                         <Lock className="h-4 w-4 mr-2" />
                         Garantir meu Plano Validado — R$ 39,90
                       </Button>
                       <div className="flex items-center gap-2 mt-3">
                         <Shield className="h-3 w-3 text-muted-foreground" />
                         <span className="text-[10px] text-muted-foreground">Pagamento seguro • Powered by Stripe</span>
                       </div>
                     </div>
                   </div>

                  {/* 24h SLA notice */}
                  <div className="rounded-lg border border-coin-gold/30 bg-coin-gold/5 p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-coin-gold-foreground">⏱ Compromisso de Qualidade:</span> Caso o seu plano não seja validado por um nutricionista em até 24 horas, o valor de R$ 39,90 será estornado automaticamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        amount={39.9}
        onApproved={() => {
          if (dietRequestId) {
            navigate("/dashboard", { replace: true });
          }
        }}
      />
    </div>
  );
}
