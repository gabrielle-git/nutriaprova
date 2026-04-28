import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wallet, Leaf, ArrowLeft, Shield, CheckCircle2,
  Phone, Mail, CreditCard, Building2, Hash, Loader2,
} from "lucide-react";

// ── Tipos de chave PIX suportados ────────────────────────────────
type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

const PIX_TYPES: { id: PixKeyType; label: string; icon: typeof Phone; placeholder: string; mask?: string }[] = [
  { id: "cpf",    label: "CPF",           icon: CreditCard, placeholder: "000.000.000-00" },
  { id: "cnpj",   label: "CNPJ",          icon: Building2,  placeholder: "00.000.000/0000-00" },
  { id: "email",  label: "E-mail",        icon: Mail,       placeholder: "seu@email.com" },
  { id: "phone",  label: "Celular",       icon: Phone,      placeholder: "+55 (11) 99999-9999" },
  { id: "random", label: "Chave Aleatória", icon: Hash,     placeholder: "cole sua chave aleatória aqui" },
];

function formatPix(value: string, type: PixKeyType): string {
  const digits = value.replace(/\D/g, "");
  if (type === "cpf") {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  if (type === "cnpj") {
    return digits
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  if (type === "phone") {
    return digits
      .slice(0, 13)
      .replace(/(\d{2})(\d)/, "+$1 ($2")
      .replace(/\((\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }
  return value; // email e aleatória: sem máscara
}

export default function CadastroPix() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [selectedType, setSelectedType] = useState<PixKeyType>("cpf");
  const [keyValue, setKeyValue] = useState("");
  const [holderName, setHolderName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleKeyChange = (raw: string) => {
    setKeyValue(formatPix(raw, selectedType));
  };

  const handleTypeChange = (type: PixKeyType) => {
    setSelectedType(type);
    setKeyValue("");
  };

  const validate = (): string | null => {
    if (!holderName.trim()) return "Informe o nome do titular da conta PIX.";
    if (!keyValue.trim()) return "Informe a chave PIX.";
    if (selectedType === "cpf" && keyValue.replace(/\D/g, "").length !== 11)
      return "CPF inválido.";
    if (selectedType === "cnpj" && keyValue.replace(/\D/g, "").length !== 14)
      return "CNPJ inválido.";
    if (selectedType === "email" && !/\S+@\S+\.\S+/.test(keyValue))
      return "E-mail inválido.";
    if (selectedType === "phone" && keyValue.replace(/\D/g, "").length < 12)
      return "Celular inválido.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!user) { toast.error("Faça login para continuar."); return; }

    setSaving(true);
    try {
      // Salva na tabela profiles como jsonb (campo pix_key)
      // Se ainda não existir a coluna, adicione via migration:
      //   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pix_key jsonb;
      const { error } = await supabase
        .from("profiles")
        .update({
          pix_key: { type: selectedType, value: keyValue, holder: holderName },
        } as any)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Chave PIX salva com sucesso!");
      setSaved(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar chave PIX.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-20 h-20 rounded-full emerald-gradient flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">Chave PIX salva!</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Seus ganhos serão enviados para essa chave após cada saque aprovado.
          </p>
          <div className="flex flex-col gap-3">
            <Button className="emerald-gradient text-primary-foreground" onClick={() => navigate("/")}>
              Ir para o Painel
            </Button>
            <Button variant="outline" onClick={() => setSaved(false)}>
              Editar Chave PIX
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <Leaf className="h-5 w-5 text-primary" />
          <span>
            Nutr<span className="text-brand-animated">IAprova</span>
          </span>
          <span className="badge-live text-xs min-h-[1em]" aria-hidden />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Cabeçalho da página */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl emerald-gradient flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold">Cadastro de Chave PIX</h1>
                <p className="text-xs text-muted-foreground">Para receber seus ganhos de validação</p>
              </div>
            </div>

            {/* Aviso de segurança */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex gap-3">
              <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sua chave PIX é usada exclusivamente para pagamento de ganhos. Não compartilhamos seus dados bancários.
              </p>
            </div>
          </div>

          {/* Seletor de tipo */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">Tipo de Chave</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PIX_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTypeChange(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                      selectedType === t.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulário */}
          <div className="space-y-4 mb-8">
            <div>
              <Label htmlFor="holder">Nome do Titular (como no banco)</Label>
              <Input
                id="holder"
                placeholder="Nome completo"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="pix-key">
                Chave PIX — {PIX_TYPES.find((t) => t.id === selectedType)?.label}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="pix-key"
                  placeholder={PIX_TYPES.find((t) => t.id === selectedType)?.placeholder}
                  value={keyValue}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  inputMode={selectedType === "email" || selectedType === "random" ? "text" : "numeric"}
                  className="pr-20"
                />
                {keyValue && (
                  <Badge
                    variant="outline"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] border-primary/30 text-primary"
                  >
                    {PIX_TYPES.find((t) => t.id === selectedType)?.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Info sobre saques */}
          <div className="rounded-xl border border-border bg-card p-4 mb-8 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-1">Como funcionam os saques</p>
            <p>• Plano <strong>Freemium</strong>: saldo trancado — disponível como crédito no upgrade.</p>
            <p>• Planos <strong>Basic, Premium e Clínica</strong>: saque manual a qualquer momento.</p>
            <p>• Pagamentos processados em até <strong>2 dias úteis</strong> via PIX.</p>
          </div>

          {/* Botão salvar */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 emerald-gradient text-primary-foreground text-base gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Salvar Chave PIX</>
            )}
          </Button>
        </motion.div>
      </main>
    </div>
  );
}