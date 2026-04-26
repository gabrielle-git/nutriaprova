import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    <Card className="card-clinical border-[hsl(var(--surface-3))] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" /> Material de apoio — WhatsApp
          </CardTitle>
          <Badge className="badge-gold w-fit text-[11px]">R$ 10 / conversão</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5 md:p-6">
        {/* Referral Link */}
        <div className="rounded-xl border border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[hsl(var(--ink-1))]">
            <Link className="h-4 w-4 text-[hsl(var(--primary))]" /> Seu link de afiliado
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <code className="flex-1 truncate rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] px-3 py-2.5 font-mono text-sm">
              {referralLink}
            </code>
            <Button type="button" size="sm" variant="secondary" className="gap-1.5 sm:shrink-0" onClick={() => copyText(referralLink)}>
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
          </div>
          <p className="mt-2 text-xs text-[hsl(var(--ink-3))]">
            Comissão em destaque: <span className="badge-gold inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold">R$ 10,00</span> por aluno que comprar com o link.
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
