import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Copy, Link } from "lucide-react";
import { toast } from "sonner";

const getScripts = (link: string) => [
  {
    title: "Convite Inicial",
    text: `Fala gigante! 💪 Eu não prescrevo dieta, mas entra nesse site do nutrIAprova. A IA monta seus macros e um Nutri de verdade valida tudo por só R$ 39,90. Segue meu link: ${link}`,
  },
  {
    title: "Follow-up (após 2 dias)",
    text: `E aí, conseguiu dar uma olhada na nutrIAprova? 🍽️ Vários dos meus alunos já estão usando e os resultados tão aparecendo rápido! Se precisar de ajuda pra começar, me avisa! Link: ${link}`,
  },
  {
    title: "Urgência / Promoção",
    text: `🔥 Última chance! A nutrIAprova tá com condição especial essa semana — dieta completa validada por nutricionista por apenas R$ 39,90. Não perde essa oportunidade! Link: ${link}`,
  },
];

export default function PTMarketingTab({ referralLink }: { referralLink: string }) {
  const scripts = getScripts(referralLink);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Texto copiado!");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Material de Apoio — Scripts para WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Link */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" /> Seu Link de Afiliado:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-background/50 px-3 py-2 rounded-md border border-border truncate">
              {referralLink}
            </code>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => copyText(referralLink)}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Você ganha <span className="text-primary font-bold">R$ 10,00</span> por cada aluno que comprar usando seu link!
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Copie e envie esses scripts prontos para seus alunos no WhatsApp. O link de afiliado já está incluído!
        </p>

        {scripts.map((script, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-display font-bold">{script.title}</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(script.text)}>
                <Copy className="h-3 w-3" /> Copiar Texto
              </Button>
            </div>
            <Textarea value={script.text} readOnly className="resize-none text-sm min-h-[100px]" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
