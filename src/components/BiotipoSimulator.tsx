import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calculator, Flame, Activity, Zap, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ── Calcula idade a partir de um Date ─────────────────────────────────────────
function calcAgeFromDate(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age--;
  return Math.max(0, age);
}

export default function BiotipoSimulator() {
  const navigate = useNavigate();

  // DatePicker
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Navegação interna do calendário — começa em 1990 para facilitar seleção de ano
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(1990, 0, 1));

  const [weight, setWeight]               = useState("");
  const [height, setHeight]               = useState("");
  const [sex, setSex]                     = useState<"M" | "F">("M");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [calculating, setCalculating]     = useState(false);
  const [result, setResult] = useState<{
    age: number; bmr: number; tdee: number; bmi: number; bmiCategory: string; biotipo: string;
  } | null>(null);

  const handleCalculate = () => {
    if (!birthDate) return;

    const w = parseFloat(weight);
    const h = parseFloat(height);
    const age = calcAgeFromDate(birthDate);

    if (!w || !h || age <= 0) return;

    setCalculating(true);
    setTimeout(() => {
      const bmr = sex === "M"
        ? 88.36 + 13.4 * w + 4.8 * h - 5.7 * age
        : 447.6 + 9.2 * w + 3.1 * h - 4.3 * age;

      const factors: Record<string, number> = {
        sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, intense: 1.9,
      };
      const tdee = bmr * (factors[activityLevel] ?? 1.55);
      const bmi  = w / ((h / 100) ** 2);

      let bmiCategory = "Normal";
      if (bmi < 18.5) bmiCategory = "Abaixo do peso";
      else if (bmi < 25) bmiCategory = "Normal";
      else if (bmi < 30) bmiCategory = "Sobrepeso";
      else bmiCategory = "Obesidade";

      let biotipo = "Mesomorfo";
      if (bmi < 20) biotipo = "Ectomorfo";
      else if (bmi > 27) biotipo = "Endomorfo";

      setResult({
        age,
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        bmi: parseFloat(bmi.toFixed(1)),
        bmiCategory,
        biotipo,
      });
      setCalculating(false);
    }, 1800);
  };

  const today = new Date();
  const minDate = new Date(1920, 0, 1);

  const canCalculate = !!birthDate && parseFloat(weight) > 0 && parseFloat(height) > 0;

  return (
    <section id="simulador" className="px-6 py-16 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent border border-primary/20 text-sm text-accent-foreground mb-4">
            <Calculator className="h-3.5 w-3.5 text-primary" />
            100% Gratuito
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">
            Simulador de <span className="text-gradient-emerald">Biotipo</span> Gratuito
          </h2>
          <p className="text-muted-foreground">
            Descubra seu gasto calórico e biotipo em segundos. Sem custo, sem cadastro.
          </p>
        </div>

        <Card className="glass-card">
          <CardContent className="pt-6 space-y-5">
            {/* Peso + Altura */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  placeholder="75"
                  value={weight}
                  min={1} max={400}
                  onChange={(e) => setWeight(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  placeholder="175"
                  value={height}
                  min={50} max={250}
                  onChange={(e) => setHeight(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* ── DatePicker de Data de Nascimento ─────────────────────── */}
            <div>
              <Label>Data de Nascimento</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "mt-1.5 w-full flex items-center justify-between rounded-md border border-input",
                      "bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors",
                      "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      !birthDate && "text-muted-foreground",
                    )}
                  >
                    <span>
                      {birthDate
                        ? format(birthDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : "Selecione sua data de nascimento"}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                  {/* Navegação por mês/ano com dropdowns */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1">
                    <Select
                      value={String(calendarMonth.getMonth())}
                      onValueChange={(v) =>
                        setCalendarMonth(
                          new Date(calendarMonth.getFullYear(), parseInt(v, 10), 1),
                        )
                      }
                    >
                      <SelectTrigger className="h-9 flex-1 text-sm">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {format(new Date(2000, i, 1), "MMMM", { locale: ptBR })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={String(calendarMonth.getFullYear())}
                      onValueChange={(v) =>
                        setCalendarMonth(
                          new Date(parseInt(v, 10), calendarMonth.getMonth(), 1),
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[108px] shrink-0 text-sm">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {Array.from(
                          { length: today.getFullYear() - 1919 },
                          (_, i) => today.getFullYear() - i,
                        ).map((yr) => (
                          <SelectItem key={yr} value={String(yr)}>
                            {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Calendar
                    mode="single"
                    selected={birthDate}
                    onSelect={(date) => {
                      setBirthDate(date);
                      if (date) setCalendarOpen(false);
                    }}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    disabled={(date) => date > today || date < minDate}
                    locale={ptBR}
                    // Oculta a caption nativa (substituída pelos nossos dropdowns)
                    classNames={{ caption: "hidden", nav: "hidden" }}
                    initialFocus
                  />

                  {birthDate && (
                    <div className="px-3 pb-3 text-xs text-muted-foreground text-center">
                      {calcAgeFromDate(birthDate)} anos
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Sexo */}
            <div>
              <Label>Sexo</Label>
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => setSex("M")}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    sex === "M" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  Masculino
                </button>
                <button
                  onClick={() => setSex("F")}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    sex === "F" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  Feminino
                </button>
              </div>
            </div>

            {/* Nível de atividade */}
            <div>
              <Label>Nível de Atividade</Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentário</SelectItem>
                  <SelectItem value="light">Levemente ativo</SelectItem>
                  <SelectItem value="moderate">Moderadamente ativo</SelectItem>
                  <SelectItem value="active">Muito ativo</SelectItem>
                  <SelectItem value="intense">Extremamente ativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão calcular */}
            <Button
              onClick={handleCalculate}
              disabled={!canCalculate || calculating}
              className="w-full emerald-gradient text-primary-foreground gap-2 h-11"
            >
              {calculating ? (
                <span className="animate-pulse">Calculando...</span>
              ) : (
                <><Calculator className="h-4 w-4" /> Calcular Meu Biotipo Grátis</>
              )}
            </Button>

            {/* Resultado */}
            <AnimatePresence>
              {result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-primary/20 bg-accent/40 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg">
                      Seu Resultado — {result.age} anos
                    </h3>
                    <span className="text-xs text-muted-foreground">Biotipo: <strong>{result.biotipo}</strong></span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { icon: Flame,    label: "Metabolismo Basal",  value: `${result.bmr} kcal/dia`, color: "text-orange-500" },
                      { icon: Activity, label: "Gasto Total (TDEE)", value: `${result.tdee} kcal/dia`, color: "text-primary" },
                      { icon: Zap,      label: "IMC",                value: `${result.bmi} — ${result.bmiCategory}`, color: "text-blue-500" },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} className="rounded-lg bg-background/60 p-3 text-center">
                          <Icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className="text-sm font-bold mt-0.5">{stat.value}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Quer um plano alimentar completo validado por nutricionista?
                    </p>
                    <Button
                      className="emerald-gradient text-primary-foreground gap-2"
                      onClick={() => navigate("/auth?role=client&openRegister=true")}
                    >
                      Obter meu plano personalizado →
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}