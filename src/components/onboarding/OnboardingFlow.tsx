import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Etapas apenas para clientes
const CLIENT_STEPS = ["goals", "allergies", "done"] as const;
const NUTRITIONIST_STEPS = ["done"] as const;

interface OnboardingFlowProps {
  role: "nutritionist" | "client";
  userId: string;
}

export default function OnboardingFlow({ role, userId }: OnboardingFlowProps) {
  const navigate = useNavigate();
  const steps = role === "nutritionist" ? NUTRITIONIST_STEPS : CLIENT_STEPS;
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");

  const goalOptions = [
    "Perda de peso",
    "Ganho de massa",
    "Saúde geral",
    "Controle de diabetes",
    "Reeducação alimentar",
  ];

 const handleFinish = async () => {
    if (role === "client") {
      await supabase.from("profiles").update({ 
        goals, 
        allergies, 
        onboarding_done: true 
      } as any).eq("user_id", userId);
    } else {
      await supabase.from("profiles").update({ 
        onboarding_done: true 
      } as any).eq("user_id", userId);
    }
    navigate(role === "nutritionist" ? "/bem-vindo-nutri" : "/");
  };
  
  const current = steps[step];

  // Nutricionistas pulam direto
  if (role === "nutritionist") {
    handleFinish();
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {current === "goals" && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Quais são seus objetivos?</h2>
            <p className="text-gray-500 text-sm mb-6">Selecione todos que se aplicam.</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {goalOptions.map((g) => (
                <button
                  key={g}
                  onClick={() =>
                    setGoals((prev) =>
                      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                    )
                  }
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    goals.includes(g)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={goals.length === 0}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Próximo
            </button>
          </>
        )}

        {current === "allergies" && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Alergias e restrições</h2>
            <p className="text-gray-500 text-sm mb-4">
              Informe alergias ou intolerâncias alimentares (opcional).
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-6"
              rows={4}
              placeholder="Ex: Lactose, glúten, amendoim..."
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold"
              >
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}