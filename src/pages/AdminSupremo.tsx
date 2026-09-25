import { useEffect, useState, useMemo, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogOut, Users, Stethoscope, DollarSign,
  AlertTriangle, Eye, FileText, Coins, Zap, FlaskConical,
  Search, Crown, CheckCircle2, Loader2, ShieldAlert, BadgeCheck, MinusCircle, PlusCircle, Star, MessageSquare,
  User, Dumbbell, BookOpen, Check, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AdminSimulationView from "@/components/AdminSimulationView";
import PremiumDietPlanView from "@/components/PremiumDietPlanView";
import PlansModal from "@/components/PlansModal";
import ClinicLogoUpload from "@/components/ClinicLogoUpload";
import LeadHunterCRM from "@/components/admin/LeadHunterCRM";
import { Radar } from "lucide-react";
import type { DietPlan } from "@/services/n8nService";
import { blogAuthorBylineFromProfile } from "@/lib/utils";
import { adminSetProfessionalApproval } from "@/services/profileSecurityService";
import { adminAdjustCredits } from "@/services/profileEconomicService";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Profile = any;
type Transaction = any;
type DietRequest = any;

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

const TITLE_WORDS = ["Admin", "Supremo"] as const;

const adminShell =
  "dark min-h-screen bg-[hsl(162_28%_4%)] text-[hsl(var(--ink-1))]";

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => {
    const f =
      decimals <= 0
        ? Math.round(v)
        : Math.round(v * 10 ** decimals) / 10 ** decimals;
    return f.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals > 0 ? decimals : 0,
      maximumFractionDigits: decimals,
    });
  });
  useEffect(() => {
    if (isInView) spring.set(value);
  }, [isInView, value, spring]);
  return (
    <motion.span ref={ref} className="tabular-nums">
      {display}
    </motion.span>
  );
}

const MotionTableRow = motion(TableRow);

const kpiContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const kpiItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ease: [0.16, 1, 0.3, 1] as const, duration: 0.45 },
  },
};

const thControl =
  "bg-[hsl(var(--surface-2))] font-display text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--ink-2))] text-left border-b border-[hsl(var(--surface-3))] h-10 px-3";

const trStriped = (i: number) =>
  [i % 2 === 0 ? "bg-[hsl(var(--surface-0))]" : "bg-[hsl(var(--surface-1))]", "border-[hsl(var(--surface-3))]"].join(" ");

const headerRow = "border-[hsl(var(--surface-3))] hover:bg-transparent";

function roleBadgeForAdmin(role: string) {
  switch (role) {
    case "client":
      return "border border-teal-500/50 bg-teal-500/10 text-teal-300";
    case "nutritionist":
      return "border border-blue-500/50 bg-blue-500/10 text-blue-300";
    case "personal_trainer":
      return "border border-amber-500/50 bg-amber-500/10 text-amber-200";
    case "admin":
      return "border border-red-500/50 bg-red-500/10 text-red-300";
    default:
      return "border border-[hsl(var(--surface-3))] text-[hsl(var(--ink-2))]";
  }
}

function roleLabelForAdmin(role: string) {
  if (role === "admin") return "Admin";
  if (role === "nutritionist") return "Nutricionista";
  if (role === "personal_trainer") return "Personal";
  return "Cliente";
}

function RoleBadgeSpring({ role }: { role: string }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="inline-flex"
    >
      <Badge variant="outline" className={roleBadgeForAdmin(role)}>
        {roleLabelForAdmin(role)}
      </Badge>
    </motion.div>
  );
}

const cardSupreme =
  "card-clinical card-scan border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] shadow-sm";

const dangerActionWrap = "rounded-xl border border-dashed border-red-800/40 bg-red-950/20 p-4";

export default function AdminSupremo() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dietRequests, setDietRequests] = useState<DietRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [devMode, setDevMode] = useState(true);
  const [creditAmount, setCreditAmount] = useState<Record<string, string>>({});
  const [creditAction, setCreditAction] = useState<Record<string, "add" | "remove">>({});

  // Search & filter
  const [userSearch, setUserSearch] = useState("");
  const [dietStatusFilter, setDietStatusFilter] = useState<string>("all");
  const [transactionSearch, setTransactionSearch] = useState("");

  // Simulation
  const [simRequest, setSimRequest] = useState<DietRequest | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [pdfRequest, setPdfRequest] = useState<DietRequest | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [viewPost, setViewPost] = useState<any | null>(null);
  const [plansModalOpen, setPlansModalOpen] = useState(false);

  // CRN Audit
  const [crnVerifying, setCrnVerifying] = useState<Record<string, boolean>>({});
  const [crnResults, setCrnResults] = useState<Record<string, "valid" | "alert" | null>>({});
  const [clock, setClock] = useState(() => new Date());

  const isSupremeAdmin = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loading && !isSupremeAdmin) {
      navigate("/");
    }
  }, [loading, isSupremeAdmin, navigate]);

  useEffect(() => {
    if (isSupremeAdmin) fetchData();
  }, [isSupremeAdmin]);

  const fetchData = async () => {
    setLoadingData(true);
    const [profilesRes, transactionsRes, dietRes, feedbackRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("diet_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("client_feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("blog_posts" as any).select("*").eq("status", "pending_review").order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (dietRes.data) setDietRequests(dietRes.data);
    if (feedbackRes.data) setFeedbacks(feedbackRes.data);
    if (postsRes.data) setPendingPosts(postsRes.data as any[]);
    setLoadingData(false);
  };

  const approvePost = async (postId: string) => {
    const post = pendingPosts.find((p) => p.id === postId);
    const author = post ? profiles.find((p) => p.user_id === post.author_id) : null;
    const fromProfile = blogAuthorBylineFromProfile(author);
    const author_display_name =
      (fromProfile.author_display_name || author?.full_name || post?.author_display_name || "").trim() || "Autor";
    const author_role_label =
      (fromProfile.author_role_label || post?.author_role_label || "").trim() || "Autor";
    const { error } = await supabase
      .from("blog_posts" as any)
      .update({
        status: "published",
        published: true,
        author_display_name,
        author_role_label,
      } as any)
      .eq("id", postId);
    if (error) toast.error(error.message);
    else {
      toast.success("Artigo aprovado e publicado com o nome do autor.");
      fetchData();
    }
  };

  const rejectPost = async (postId: string) => {
    if (!confirm("Recusar e excluir este artigo?")) return;
    const { error } = await supabase.from("blog_posts" as any).delete().eq("id", postId);
    if (error) toast.error(error.message);
    else {
      toast.success("Artigo recusado e removido.");
      fetchData();
    }
  };

  const toggleApproval = async (p: Profile) => {
    try {
      await adminSetProfessionalApproval(p.user_id, !p.approved);
      toast.success(p.approved ? "Nutricionista suspenso" : "Nutricionista aprovado");
      fetchData();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const addCredits = async (p: Profile) => {
    const amount = parseInt(creditAmount[p.id] || "0");
    const action = creditAction[p.id] || "add";
    if (!amount || amount <= 0) { toast.error("Informe um valor válido"); return; }

    const delta = action === "add" ? amount : -amount;
    try {
      await adminAdjustCredits(
        p.user_id,
        delta,
        `Admin Supreme ${action === "add" ? "adicionou" : "removeu"} ${amount} moedas`,
      );
      toast.success(`${amount} moedas ${action === "add" ? "adicionadas" : "removidas"} para ${p.full_name}`);
      setCreditAmount({ ...creditAmount, [p.id]: "" });
      fetchData();
    } catch {
      toast.error("Erro ao ajustar créditos");
    }
  };

  const handleCrnVerify = (profileId: string) => {
    setCrnVerifying(prev => ({ ...prev, [profileId]: true }));
    setCrnResults(prev => ({ ...prev, [profileId]: null }));
    setTimeout(() => {
      const isValid = Math.random() > 0.2;
      setCrnResults(prev => ({ ...prev, [profileId]: isValid ? "valid" : "alert" }));
      setCrnVerifying(prev => ({ ...prev, [profileId]: false }));
    }, 2000);
  };

  const markDietCompleted = async (req: DietRequest) => {
    await supabase.from("diet_requests").update({
      status: "completed", notes: "Validado manualmente pelo Admin Supremo"
    }).eq("id", req.id);
    toast.success("Dieta marcada como validada!");
    fetchData();
  };

  const getHoursPending = (createdAt: string) =>
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  // Filtered data
  const allUsers = useMemo(() =>
    profiles.filter(p =>
      !userSearch || p.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (p.crn_number && p.crn_number.toLowerCase().includes(userSearch.toLowerCase()))
    ), [profiles, userSearch]);

  const filteredDiets = useMemo(() =>
    dietRequests.filter(d => dietStatusFilter === "all" || d.status === dietStatusFilter),
    [dietRequests, dietStatusFilter]);

  const filteredTransactions = useMemo(() =>
    transactions.filter(t =>
      !transactionSearch || (t.description && t.description.toLowerCase().includes(transactionSearch.toLowerCase())) ||
      t.id.includes(transactionSearch)
    ), [transactions, transactionSearch]);

  const txChartData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t: Transaction) => {
      const d = new Date(t.created_at);
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Math.abs(Number(t.amount) || 0));
    });
    const out: { day: string; volume: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        day: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        volume: map.get(key) ?? 0,
      });
    }
    return out;
  }, [transactions]);

  const { scrollY } = useScroll();
  const gridOpacity = useTransform(scrollY, [0, 500], [0.2, 0.08]);

  const nutritionists = allUsers.filter(p => p.role === "nutritionist");
  const clients = allUsers.filter(p => p.role === "client");
  const completedCount = dietRequests.filter(d => d.status === "completed").length;
  const pendingCount = dietRequests.filter(d => d.status === "pending").length;

  if (loading || !isSupremeAdmin) {
    return (
      <motion.div
        className={`${adminShell} relative flex min-h-screen items-center justify-center`}
        style={{ colorScheme: "dark" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-grid opacity-20 [background-image:linear-gradient(hsl(158_35%_22%_/_0.35)_1px,transparent_1px),linear-gradient(90deg,hsl(158_35%_22%_/_0.35)_1px,transparent_1px)]"
          aria-hidden
        />
        <Crown className="relative z-10 h-8 w-8 text-primary animate-pulse" />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${adminShell} relative min-h-screen`}
      style={{ colorScheme: "dark" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="pointer-events-none fixed top-0 left-0 right-0 z-[999]"
        style={{
          height: "2px",
          background: "linear-gradient(90deg, transparent, hsl(158 80% 55%), transparent)",
          boxShadow: "0 0 20px hsl(158 80% 55% / 0.8)",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 8 }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <motion.div
          className="bg-grid absolute inset-0"
          style={{
            opacity: gridOpacity,
            backgroundImage:
              "linear-gradient(hsl(158 35% 22% / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(158 35% 22% / 0.35) 1px, transparent 1px)",
          }}
        />
        <div className="absolute inset-0 bg-[hsl(158_40%_12%_/_0.06)]" />
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(158_80%_55%_/_0.22)] to-transparent"
          style={{
            top: "22%",
            animation: "scanLine 11s ease-in-out infinite",
            animationDelay: "1.5s",
          }}
        />
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(158_80%_55%_/_0.15)] to-transparent"
          style={{
            top: "58%",
            animation: "scanLine 13s ease-in-out infinite",
            animationDelay: "6s",
          }}
        />
      </div>

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[hsl(var(--surface-3))] bg-[hsl(162,22%,6%)]/95 px-4 py-3 backdrop-blur-md md:px-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left md:gap-3"
        >
          <Crown className="h-5 w-5 shrink-0 text-primary" />
          <motion.div
            className="flex min-w-0 flex-wrap items-baseline gap-x-2"
            whileHover={{
              textShadow: [
                "0 0 0 transparent",
                "2px 0 0 hsl(0 80% 55% / 0.5), -2px 0 0 hsl(217 85% 55% / 0.5)",
                "0 0 0 transparent",
              ],
              transition: { duration: 0.3 },
            }}
          >
            <h1 className="font-display flex flex-wrap items-baseline gap-x-2 text-lg font-extrabold leading-none tracking-[-0.04em] text-[hsl(var(--ink-1))] min-[400px]:text-xl">
              {TITLE_WORDS.map((word, i) => (
                <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-0.5">
                  <motion.span
                    className="inline-block"
                    initial={{ y: "110%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.08 + i * 0.11,
                      duration: 0.55,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>
          </motion.div>
          <Badge
            className="hidden border border-red-800 bg-red-950 text-[0.7rem] font-bold uppercase leading-none text-red-300 sm:inline-flex"
            variant="outline"
          >
            ⚡ SUPREMO
          </Badge>
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <time
            className="max-w-[9rem] shrink-0 truncate font-mono text-[10px] leading-tight text-[hsl(var(--ink-3))] sm:max-w-none sm:text-xs"
            dateTime={clock.toISOString()}
            suppressHydrationWarning
          >
            {clock.toLocaleString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <span className="max-w-[140px] truncate text-xs text-[hsl(var(--ink-3))] sm:max-w-none sm:text-sm">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="shrink-0 text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink-1))]"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <p className="max-w-2xl font-mono text-[11px] font-normal uppercase tracking-[0.2em] text-[hsl(var(--ink-3))]">
            Nódulo de controle · acesso level supremo
          </p>
          <div className="flex w-full items-center justify-between gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 sm:w-auto">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">God Mode</span>
            </div>
            <Switch checked={devMode} onCheckedChange={setDevMode} />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {devMode && (
            <motion.div
              key="god-banner"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <FlaskConical className="h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-display text-sm font-bold text-[hsl(var(--ink-1))]">
                    🧪 God Mode ativo — CRN bypass + controle total
                  </p>
                  <p className="text-xs text-[hsl(var(--ink-3))]">
                    Simule validações, adicione moedas, marque dietas como concluídas e teste todo o fluxo sem restrições.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {devMode && (
            <motion.div
              key="god-nav"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              <Button
                variant="outline"
                className="h-12 gap-2 border-[hsl(var(--surface-3))] text-[hsl(var(--ink-1))] hover:border-primary/40 hover:bg-primary/10"
                onClick={() => navigate("/?as=client")}
              >
                <User className="h-4 w-4 text-primary" />
                Ver visão do cliente
              </Button>
              <Button
                variant="outline"
                className="h-12 gap-2 border-[hsl(var(--surface-3))] text-[hsl(var(--ink-1))] hover:border-primary/40 hover:bg-primary/10"
                onClick={() => navigate("/?as=nutritionist")}
              >
                <Stethoscope className="h-4 w-4 text-primary" />
                Ver visão do nutricionista
              </Button>
              <Button
                variant="outline"
                className="h-12 gap-2 border-[hsl(var(--surface-3))] text-[hsl(var(--ink-1))] hover:border-primary/40 hover:bg-primary/10"
                onClick={() => navigate("/personal-dashboard")}
              >
                <Dumbbell className="h-4 w-4 text-primary" />
                Ver visão do personal
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4"
          variants={kpiContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div variants={kpiItemVariants}>
            <Card className={cardSupreme}>
              <CardContent className="p-6">
                <DollarSign className="mb-2 h-6 w-6 text-primary/80" />
                <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Receita total</p>
                <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-brand">
                  R$ <AnimatedNumber value={completedCount * 39.9} decimals={2} />
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={kpiItemVariants}>
            <Card className={cardSupreme}>
              <CardContent className="p-6">
                <Stethoscope className="mb-2 h-6 w-6 text-primary/80" />
                <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Nutricionistas</p>
                <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-brand">
                  <AnimatedNumber value={nutritionists.length} />
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={kpiItemVariants}>
            <Card className={cardSupreme}>
              <CardContent className="p-6">
                <Users className="mb-2 h-6 w-6 text-primary/80" />
                <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Clientes</p>
                <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-brand">
                  <AnimatedNumber value={clients.length} />
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={kpiItemVariants}>
            <Card className={cardSupreme}>
              <CardContent className="p-6">
                <AlertTriangle className="mb-2 h-6 w-6 text-[hsl(var(--coin-gold))]/90" />
                <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Pendentes</p>
                <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-brand">
                  <AnimatedNumber value={pendingCount} />
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <Tabs defaultValue="audit" className="space-y-4">
          <TabsList className="flex w-full flex-wrap gap-0.5 border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1.5">
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Users className="mr-1 h-4 w-4" /> Auditoria
            </TabsTrigger>
            <TabsTrigger
              value="queue"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <FileText className="mr-1 h-4 w-4" /> Fila de dietas
            </TabsTrigger>
            <TabsTrigger
              value="financial"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <DollarSign className="mr-1 h-4 w-4" /> Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="crn-audit"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <ShieldAlert className="mr-1 h-4 w-4" /> Auditoria CRN
            </TabsTrigger>
            <TabsTrigger
              value="feedback"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Star className="mr-1 h-4 w-4" /> Qualidade
            </TabsTrigger>
            <TabsTrigger
              value="blog-triage"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <BookOpen className="mr-1 h-4 w-4" /> Moderação
              {pendingPosts.length > 0 && (
                <Badge className="ml-1.5 h-4 border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-200">
                  {pendingPosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="plans"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Crown className="mr-1 h-4 w-4" /> Planos & clínica
            </TabsTrigger>
            <TabsTrigger
              value="crm"
              className="data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Radar className="mr-1 h-4 w-4" /> Radar de leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crm">
            <div className="rounded-[var(--radius)] border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-1">
              <LeadHunterCRM />
            </div>
          </TabsContent>

          {/* User Audit */}
          <TabsContent value="audit">
            <Card className={cardSupreme}>
              <CardHeader className="pb-3">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <CardTitle className="font-display text-[hsl(var(--ink-1))]">Auditoria de usuários</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--ink-3))]" />
                    <Input
                      placeholder="Buscar por nome ou CRN..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] pl-9 text-[hsl(var(--ink-1))] placeholder:text-[hsl(var(--ink-3))]"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-[hsl(var(--surface-3))]">
                  <Table>
                    <TableHeader>
                      <TableRow className={headerRow}>
                        <TableHead className={thControl}>Nome</TableHead>
                        <TableHead className={thControl}>Papel</TableHead>
                        <TableHead className={thControl}>CRN</TableHead>
                        <TableHead className={thControl}>Moedas</TableHead>
                        <TableHead className={thControl}>Status</TableHead>
                        <TableHead className={thControl}>Dietas</TableHead>
                        <TableHead className={thControl}>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers.map((p, rowIdx) => {
                        const userDiets = dietRequests.filter(d =>
                          p.role === "nutritionist" ? d.nutritionist_id === p.user_id : d.client_id === p.user_id
                        );
                        return (
                          <MotionTableRow
                            key={p.id}
                            className={trStriped(rowIdx)}
                            whileHover={{ backgroundColor: "hsl(158 72% 32% / 0.08)", x: 2 }}
                            transition={{ duration: 0.1 }}
                          >
                            <TableCell className="px-3 font-medium text-[hsl(var(--ink-1))]">{p.full_name || "—"}</TableCell>
                            <TableCell className="px-3">
                              <RoleBadgeSpring role={p.role} />
                            </TableCell>
                            <TableCell className="px-3 text-[hsl(var(--ink-2))]">{p.crn_number || "—"}</TableCell>
                            <TableCell className="px-3">
                              <div className="flex items-center gap-1 text-[hsl(var(--ink-1))]">
                                <Coins className="h-3 w-3 text-[hsl(45,93%,47%)]" />
                                {p.credits}
                              </div>
                            </TableCell>
                            <TableCell className="px-3">
                              {p.role === "nutritionist" && (
                                <div className="flex items-center gap-2">
                                  <Badge variant={p.approved ? "default" : "destructive"} className="text-xs">
                                    {p.approved ? "Aprovado" : "Pendente"}
                                  </Badge>
                                  <Switch checked={p.approved} onCheckedChange={() => toggleApproval(p)} />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-3 text-[hsl(var(--ink-2))]">{userDiets.length}</TableCell>
                            <TableCell className="px-3">
                            {(p.role === "nutritionist" || p.role === "admin") && (
                                <div
                                  className={
                                    (creditAction[p.id] || "add") === "remove" ? dangerActionWrap : "flex items-center gap-1"
                                  }
                                >
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className={`h-7 w-7 ${(creditAction[p.id] || "add") === "add" ? "text-primary" : "text-muted-foreground"}`}
                                      onClick={() => setCreditAction({ ...creditAction, [p.id]: "add" })}
                                    >
                                      <PlusCircle className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className={`h-7 w-7 ${creditAction[p.id] === "remove" ? "text-destructive" : "text-muted-foreground"}`}
                                      onClick={() => setCreditAction({ ...creditAction, [p.id]: "remove" })}
                                    >
                                      <MinusCircle className="h-3.5 w-3.5" />
                                    </Button>
                                    <Input
                                      type="number"
                                      placeholder="Qtd"
                                      className="h-8 w-16 border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] text-xs text-[hsl(var(--ink-1))]"
                                      value={creditAmount[p.id] || ""}
                                      onChange={(e) => setCreditAmount({ ...creditAmount, [p.id]: e.target.value })}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-[hsl(var(--surface-3))] text-xs text-[hsl(var(--ink-1))] hover:bg-[hsl(var(--surface-2))]"
                                      onClick={() => addCredits(p)}
                                    >
                                      <Coins className="mr-1 h-3 w-3" /> {(creditAction[p.id] || "add") === "add" ? "Add" : "Rem"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </MotionTableRow>
                        );
                      })}
                      {allUsers.length === 0 && (
                        <TableRow className="border-[hsl(var(--surface-3))]">
                          <TableCell colSpan={7} className="py-8 text-center text-[hsl(var(--ink-3))]">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Diet Queue */}
          <TabsContent value="queue">
            <Card className={cardSupreme}>
              <CardHeader className="pb-3">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <CardTitle className="font-display text-[hsl(var(--ink-1))]">Fila de solicitações</CardTitle>
                  <Select value={dietStatusFilter} onValueChange={setDietStatusFilter}>
                    <SelectTrigger className="w-48 border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] text-[hsl(var(--ink-1))]">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent className="border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_review">Em Revisão</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-[hsl(var(--surface-3))]">
                  <Table>
                    <TableHeader>
                      <TableRow className={headerRow}>
                        <TableHead className={thControl}>ID</TableHead>
                        <TableHead className={thControl}>Status</TableHead>
                        <TableHead className={thControl}>Criado</TableHead>
                        <TableHead className={thControl}>Horas</TableHead>
                        <TableHead className={thControl}>Alerta</TableHead>
                        <TableHead className={thControl}>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDiets.map((req, rowIdx) => {
                        const hours = getHoursPending(req.created_at);
                        const isUrgent = req.status === "pending" && hours >= 18;
                        return (
                          <MotionTableRow
                            key={req.id}
                            className={
                              isUrgent
                                ? "border-[hsl(var(--surface-3))] bg-destructive/10"
                                : trStriped(rowIdx)
                            }
                            whileHover={{ backgroundColor: "hsl(158 72% 32% / 0.08)", x: 2 }}
                            transition={{ duration: 0.1 }}
                          >
                            <TableCell className="px-3 font-mono text-xs text-[hsl(var(--ink-2))]">{req.id.slice(0, 8)}</TableCell>
                            <TableCell className="px-3">
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                className="inline-flex"
                              >
                                <Badge variant={req.status === "completed" ? "default" : req.status === "in_review" ? "secondary" : "outline"}
                                  className={req.status === "pending" ? "border-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" : ""}>
                                  {req.status === "pending" ? "Pendente" : req.status === "in_review" ? "Em Revisão" : "Concluído"}
                                </Badge>
                              </motion.div>
                            </TableCell>
                            <TableCell className="px-3 text-xs text-[hsl(var(--ink-2))]">{new Date(req.created_at).toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="px-3">
                              {req.status === "pending" ? (
                                <span className={`text-[hsl(var(--ink-1))] ${isUrgent ? "font-bold text-destructive" : ""}`}>{hours.toFixed(1)}h</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="px-3">
                              {isUrgent && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                  className="inline-flex"
                                >
                                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />SLA 24h</Badge>
                                </motion.div>
                              )}
                            </TableCell>
                             <TableCell className="px-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {req.ai_draft && (
                                  <Button size="sm" variant="outline"
                                    className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                    onClick={() => { setPdfRequest(req); setPdfOpen(true); }}>
                                    <FileText className="h-3 w-3" /> Ver PDF
                                  </Button>
                                )}
                                {devMode && req.status !== "completed" && (
                                  <>
                                    <Button size="sm" variant="outline"
                                      className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                      onClick={() => {
                                        toast.info("Abrindo simulação do fluxo…", { duration: 1800 });
                                        setSimRequest(req);
                                        setSimOpen(true);
                                      }}>
                                      <Eye className="h-3 w-3" /> Testar Fluxo
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                      onClick={() => {
                                        toast.info("Enviando validação da dieta…", { duration: 1800 });
                                        void markDietCompleted(req);
                                      }}>
                                      <CheckCircle2 className="h-3 w-3" /> Validar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </MotionTableRow>
                        );
                      })}
                      {filteredDiets.length === 0 && (
                        <TableRow className="border-[hsl(var(--surface-3))]">
                          <TableCell colSpan={6} className="py-8 text-center text-[hsl(var(--ink-3))]">
                            Nenhuma solicitação encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial */}
          <TabsContent value="financial">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className={cardSupreme}>
                  <CardContent className="p-6 text-center">
                    <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Receita bruta</p>
                    <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-brand">
                      R$ <AnimatedNumber value={completedCount * 39.9} decimals={2} />
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">R$ 39,90 / plano</p>
                  </CardContent>
                </Card>
                <Card className={cardSupreme}>
                  <CardContent className="p-6 text-center">
                    <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Pendente p/ nutris</p>
                    <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-destructive">
                      R$ <AnimatedNumber value={completedCount * 15} decimals={2} />
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">R$ 15 / validação</p>
                  </CardContent>
                </Card>
                <Card className={cardSupreme}>
                  <CardContent className="p-6 text-center">
                    <p className="text-[11px] font-sans font-normal uppercase tracking-widest text-[hsl(var(--ink-3))]">Lucro plataforma</p>
                    <p className="mt-1 font-display text-[2.5rem] font-extrabold leading-none text-brand">
                      R$ <AnimatedNumber value={completedCount * 24.9} decimals={2} />
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">R$ 24,90 / plano</p>
                  </CardContent>
                </Card>
              </div>

              <Card className={cardSupreme}>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-sm text-[hsl(var(--ink-2))]">
                    Volume de movimentações (14 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px] pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={txChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(158 40% 20%)" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--ink-3))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--ink-3))", fontSize: 10 }} width={36} />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="hsl(158 80% 55%)"
                        fill="hsl(158 72% 32% / 0.2)"
                        isAnimationActive
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className={cardSupreme}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <CardTitle className="font-display text-[hsl(var(--ink-1))]">Log de transações</CardTitle>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--ink-3))]" />
                      <Input
                        placeholder="Buscar transações..."
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                        className="border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] pl-9 text-[hsl(var(--ink-1))] placeholder:text-[hsl(var(--ink-3))]"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border border-[hsl(var(--surface-3))]">
                    <Table>
                      <TableHeader>
                        <TableRow className={headerRow}>
                          <TableHead className={thControl}>ID</TableHead>
                          <TableHead className={thControl}>Tipo</TableHead>
                          <TableHead className={thControl}>Valor</TableHead>
                          <TableHead className={thControl}>Split</TableHead>
                          <TableHead className={thControl}>Descrição</TableHead>
                          <TableHead className={thControl}>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((t, rowIdx) => (
                          <MotionTableRow
                            key={t.id}
                            className={trStriped(rowIdx)}
                            whileHover={{ backgroundColor: "hsl(158 72% 32% / 0.08)", x: 2 }}
                            transition={{ duration: 0.1 }}
                          >
                            <TableCell className="px-3 font-mono text-xs text-[hsl(var(--ink-2))]">{t.id.slice(0, 8)}</TableCell>
                            <TableCell className="px-3">
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                className="inline-flex"
                              >
                                <Badge
                                  variant="outline"
                                  className={
                                    t.type === "credit_purchase"
                                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                                      : t.type === "job_acceptance"
                                        ? "border-blue-500/50 bg-blue-500/10 text-blue-200"
                                        : "border-amber-500/50 bg-amber-500/10 text-amber-200"
                                  }
                                >
                                  {t.type === "credit_purchase" ? "Compra" : t.type === "job_acceptance" ? "Aceite" : "Reembolso"}
                                </Badge>
                              </motion.div>
                            </TableCell>
                            <TableCell className={`px-3 font-medium ${t.amount >= 0 ? "text-primary" : "text-destructive"}`}>
                              {t.amount >= 0 ? "+" : ""}{t.amount}
                            </TableCell>
                            <TableCell className="px-3">
                              <div className="text-xs">
                                <span className="text-primary">R$ 24,90</span>
                                <span className="text-[hsl(var(--ink-3))]"> / </span>
                                <span className="text-[hsl(var(--ink-1))]">R$ 15,00</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 text-xs text-[hsl(var(--ink-2))]">{t.description || "—"}</TableCell>
                            <TableCell className="px-3 text-xs text-[hsl(var(--ink-2))]">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          </MotionTableRow>
                        ))}
                        {filteredTransactions.length === 0 && (
                          <TableRow className="border-[hsl(var(--surface-3))]">
                            <TableCell colSpan={6} className="py-8 text-center text-[hsl(var(--ink-3))]">
                              Nenhuma transação
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CRN Audit */}
          <TabsContent value="crn-audit">
            <Card className={cardSupreme}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--ink-1))]">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Auditoria de CRN — verificação com IA
                </CardTitle>
                <p className="text-xs text-[hsl(var(--ink-3))]">
                  Simule a consulta automatizada à base nacional de registros profissionais.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-[hsl(var(--surface-3))]">
                  <Table>
                    <TableHeader>
                      <TableRow className={headerRow}>
                        <TableHead className={thControl}>Nome</TableHead>
                        <TableHead className={thControl}>CRN</TableHead>
                        <TableHead className={thControl}>Status aprovação</TableHead>
                        <TableHead className={thControl}>Resultado IA</TableHead>
                        <TableHead className={thControl}>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nutritionists.map((p, rowIdx) => (
                        <MotionTableRow
                          key={p.id}
                          className={trStriped(rowIdx)}
                          whileHover={{ backgroundColor: "hsl(158 72% 32% / 0.08)", x: 2 }}
                          transition={{ duration: 0.1 }}
                        >
                          <TableCell className="px-3 font-medium text-[hsl(var(--ink-1))]">{p.full_name || "—"}</TableCell>
                          <TableCell className="px-3 font-mono text-sm text-[hsl(var(--ink-1))]">{p.crn_number || "Não informado"}</TableCell>
                          <TableCell className="px-3">
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="inline-flex"
                            >
                              <Badge variant={p.approved ? "default" : "destructive"} className="text-xs">
                                {p.approved ? "Aprovado" : "Pendente"}
                              </Badge>
                            </motion.div>
                          </TableCell>
                          <TableCell className="px-3">
                            {crnVerifying[p.id] ? (
                              <div className="flex items-center gap-2 text-xs text-[hsl(var(--ink-3))]">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Consultando base nacional...
                              </div>
                            ) : crnResults[p.id] === "valid" ? (
                              <Badge className="gap-1 border border-primary/30 bg-primary/20 text-primary">
                                <BadgeCheck className="h-3 w-3" /> Validado: Nome confere com CRN
                              </Badge>
                            ) : crnResults[p.id] === "alert" ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> Alerta: Divergência de Dados
                              </Badge>
                            ) : (
                              <span className="text-xs text-[hsl(var(--ink-3))]">Não verificado</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-primary/30 text-xs text-primary hover:bg-primary/10"
                              onClick={() => handleCrnVerify(p.id)}
                              disabled={crnVerifying[p.id] || !p.crn_number}
                            >
                              {crnVerifying[p.id] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ShieldAlert className="h-3 w-3" />
                              )}
                              Verificar com IA
                            </Button>
                          </TableCell>
                        </MotionTableRow>
                      ))}
                      {nutritionists.length === 0 && (
                        <TableRow className="border-[hsl(var(--surface-3))]">
                          <TableCell colSpan={5} className="py-8 text-center text-[hsl(var(--ink-3))]">
                            Nenhum nutricionista registrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Feedback */}
          <TabsContent value="feedback">
            <Card className={cardSupreme}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--ink-1))]">
                  <Star className="h-5 w-5 text-[hsl(45,93%,47%)]" />
                  Controle de qualidade — avaliações
                </CardTitle>
                <p className="text-xs text-[hsl(var(--ink-3))]">
                  Monitore as notas (1 a 5 estrelas) e comentários para garantir a qualidade do atendimento dos nutricionistas.
                </p>
              </CardHeader>
              <CardContent>
                {feedbacks.length === 0 ? (
                  <div className="py-12 text-center text-[hsl(var(--ink-3))]">
                    <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-30" />
                    <p className="text-sm">Nenhum feedback recebido ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((fb) => {
                      const clientProfile = profiles.find(p => p.user_id === fb.client_id);
                      const isNegative = fb.rating <= 2;
                      return (
                        <div
                          key={fb.id}
                          className={`rounded-lg border p-4 ${
                            isNegative
                              ? "border-destructive/50 bg-destructive/10"
                              : "border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))]"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isNegative ? "text-destructive" : "text-[hsl(var(--ink-1))]"}`}>
                                {clientProfile?.full_name || "Cliente anônimo"}
                              </span>
                              <span className="text-xs text-[hsl(var(--ink-3))]">
                                #{fb.diet_request_id?.slice(0, 8)}
                              </span>
                              {isNegative && (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Negativo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${star <= fb.rating ? "text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]" : "text-[hsl(var(--surface-3))]"}`}
                                  />
                                ))}
                              </div>
                              {isNegative && (
                                <div className={dangerActionWrap}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/15"
                                    onClick={() => toast.info(`Iniciando contato com ${clientProfile?.full_name || "cliente"}...`)}
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    Entrar em contato
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          {fb.comment && (
                            <p className={`text-sm italic ${isNegative ? "text-destructive/80" : "text-[hsl(var(--ink-2))]"}`}>
                              "{fb.comment}"
                            </p>
                          )}
                          <p className="mt-2 text-xs text-[hsl(var(--ink-3))]">
                            {new Date(fb.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blog Triage */}
          <TabsContent value="blog-triage">
            <Card className={cardSupreme}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 font-display text-[hsl(var(--ink-1))]">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Revisão de artigos
                  <Badge variant="outline" className="ml-0 border-primary/40 text-primary sm:ml-2">
                    {pendingPosts.length} pendente{pendingPosts.length === 1 ? "" : "s"}
                  </Badge>
                </CardTitle>
                <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">
                  Artigos enviados por nutricionistas e personals aguardando aprovação para publicação no blog público.
                </p>
              </CardHeader>
              <CardContent>
                {pendingPosts.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary/40" />
                    <p className="text-[hsl(var(--ink-3))]">Nenhum artigo aguardando revisão.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingPosts.map((post) => {
                      const author = profiles.find((p) => p.user_id === post.author_id);
                      return (
                        <div
                          key={post.id}
                          className="rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row">
                            {post.cover_image_url && (
                              <img
                                src={post.cover_image_url}
                                alt={post.title}
                                className="h-24 w-full shrink-0 rounded-md border border-[hsl(var(--surface-3))] object-cover md:w-32"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-[hsl(var(--surface-3))] text-xs text-[hsl(var(--ink-2))]">
                                  {post.category}
                                </Badge>
                                <Badge variant="outline" className="border-[hsl(45,93%,47%)] text-xs text-[hsl(45,93%,47%)]">
                                  ⏳ Pendente
                                </Badge>
                                <span className="text-xs text-[hsl(var(--ink-3))]">
                                  {author?.full_name || "Autor desconhecido"}
                                  {author?.role && ` • ${author.role === "nutritionist" ? "Nutricionista" : author.role === "personal_trainer" ? "Personal" : author.role}`}
                                </span>
                                <span className="text-xs text-[hsl(var(--ink-3))]">
                                  {new Date(post.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                              <h3 className="mb-1 font-display font-bold text-[hsl(var(--ink-1))]">
                                {post.title}
                              </h3>
                              <p className="line-clamp-2 text-sm text-[hsl(var(--ink-2))]">
                                {post.excerpt || post.content.slice(0, 200)}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => setViewPost(post)}
                                >
                                  <Eye className="h-3.5 w-3.5" /> Ler artigo completo
                                </Button>
                                <Button
                                  size="sm"
                                  className="emerald-gradient gap-1 text-primary-foreground"
                                  onClick={() => approvePost(post.id)}
                                >
                                  <Check className="h-3.5 w-3.5" /> Aprovar e publicar
                                </Button>
                                <div className={dangerActionWrap}>
                                  <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-red-300/80">
                                    Ação destrutiva
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/50 bg-red-950/30 text-destructive hover:bg-red-950/50"
                                    onClick={() => rejectPost(post.id)}
                                  >
                                    <X className="h-3.5 w-3.5" /> Recusar (excluir)
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans & Clinic Logo Tab — Admin can preview tier features */}
          <TabsContent value="plans">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className={cardSupreme}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--ink-1))]">
                    <Crown className="h-5 w-5 text-primary" />
                    Visualizar planos da plataforma
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-[hsl(var(--ink-2))]">
                    Abra o modal de planos exatamente como nutricionistas e personals veem.
                  </p>
                  <Button
                    onClick={() => setPlansModalOpen(true)}
                    className="emerald-gradient gap-2 text-primary-foreground"
                  >
                    <Crown className="h-4 w-4" /> Abrir modal de planos
                  </Button>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[hsl(var(--surface-3))] pt-4">
                    <div className="text-center">
                      <p className="text-xs text-[hsl(var(--ink-3))]">Basic</p>
                      <p className="font-display font-bold text-[hsl(var(--ink-1))]">{profiles.filter(p => ((p as any).plan_tier || "basic") === "basic").length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[hsl(var(--ink-3))]">Premium</p>
                      <p className="font-display font-bold text-primary">{profiles.filter(p => (p as any).plan_tier === "premium").length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[hsl(var(--ink-3))]">Clínica</p>
                      <p className="font-display font-bold text-[hsl(var(--coin-gold))]">{profiles.filter(p => (p as any).plan_tier === "clinic").length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="dark [&>div]:card-clinical [&>div]:border-[hsl(var(--surface-3))] [&>div]:bg-[hsl(var(--surface-0))] [&_*]:!text-[hsl(var(--ink-1))] [&_p.text-muted-foreground]:!text-[hsl(var(--ink-2))]">
                <ClinicLogoUpload />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Simulation Sheet */}
      {simRequest && (
        <AdminSimulationView
          request={simRequest}
          open={simOpen}
          onOpenChange={setSimOpen}
          onComplete={fetchData}
        />
      )}

      {/* PDF Full-Screen Modal */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="dark max-h-[90vh] max-w-4xl overflow-y-auto border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FileText className="h-5 w-5 text-primary" />
              Visualização do plano — #{pdfRequest?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {pdfRequest?.ai_draft && (
            <PremiumDietPlanView
              plan={pdfRequest.ai_draft as unknown as DietPlan}
              nutritionistName="Admin Supremo"
              crnNumber="Bypass"
              isCompleted={pdfRequest.status === "completed"}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Article Full-Read Modal */}
      <Dialog open={!!viewPost} onOpenChange={(o) => !o && setViewPost(null)}>
        <DialogContent className="dark max-h-[90vh] max-w-3xl overflow-y-auto border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <BookOpen className="h-5 w-5 text-primary" />
              {viewPost?.title}
            </DialogTitle>
          </DialogHeader>
          {viewPost && (
            <div className="space-y-4">
              {viewPost.cover_image_url && (
                <img src={viewPost.cover_image_url} alt={viewPost.title} className="max-h-72 w-full rounded-lg border border-[hsl(var(--surface-3))] object-cover" />
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--ink-2))]">
                <Badge variant="outline" className="border-[hsl(var(--surface-3))]">
                  {viewPost.category}
                </Badge>
                <span>{new Date(viewPost.created_at).toLocaleDateString("pt-BR")}</span>
                <span>•</span>
                <span>{profiles.find((p) => p.user_id === viewPost.author_id)?.full_name || "Autor"}</span>
              </div>
              {viewPost.excerpt && (
                <p className="border-l-2 border-primary/40 pl-3 text-sm italic text-[hsl(var(--ink-2))]">{viewPost.excerpt}</p>
              )}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[hsl(var(--ink-1))]">
                {viewPost.content}
              </div>
              <div className="flex flex-col gap-3 border-t border-[hsl(var(--surface-3))] pt-4 sm:flex-row">
                <Button
                  className="emerald-gradient flex-1 gap-1 text-primary-foreground"
                  onClick={() => {
                    approvePost(viewPost.id);
                    setViewPost(null);
                  }}
                >
                  <Check className="h-4 w-4" /> Aprovar e publicar
                </Button>
                <div className={`${dangerActionWrap} flex-1 sm:max-w-[min(100%,12rem)]`}>
                  <Button
                    variant="outline"
                    className="w-full gap-1 border-red-500/50 bg-red-950/30 text-destructive hover:bg-red-950/50"
                    onClick={() => {
                      rejectPost(viewPost.id);
                      setViewPost(null);
                    }}
                  >
                    <X className="h-4 w-4" /> Recusar (excluir)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlansModal open={plansModalOpen} onOpenChange={setPlansModalOpen} currentTier="clinic" />
    </motion.div>
  );
}
