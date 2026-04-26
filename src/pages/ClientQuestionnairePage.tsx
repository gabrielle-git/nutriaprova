import AppHeader from "@/components/AppHeader";
import ClientOnboarding from "@/components/ClientOnboarding";

export default function ClientQuestionnairePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">
            Questionário Inteligente
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">
            Monte seu plano personalizado
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Preencha seus dados para a IA gerar seu cardápio e desbloqueie quando estiver pronto.
          </p>
        </div>
        <ClientOnboarding />
      </div>
    </div>
  );
}
