import { type ComponentProps, useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Settings, LogOut, Coins, Crown, X, Dumbbell, Users, Sun, Moon, Home, BookOpen, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

function formatNotificationTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `${diffMinutes}min atrás`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 dia atrás";
  if (diffDays < 7) return `${diffDays} dias atrás`;

  return new Date(iso).toLocaleDateString("pt-BR");
}

function getInitials(fullName: string | null | undefined, email: string | undefined) {
  const n = (fullName || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return (email || "?").slice(0, 2).toUpperCase();
}

function isRouteActive(pathname: string, href: string) {
  if (href === "/inicio") return pathname === "/inicio" || pathname.startsWith("/inicio/");
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isPersonalDashboardPath(pathname: string) {
  return (
    pathname === "/personal" ||
    pathname === "/personal-dashboard" ||
    pathname.startsWith("/personal-dashboard/")
  );
}

function isNutriDashboardPath(pathname: string) {
  return pathname === "/nutri-dashboard" || pathname.startsWith("/nutri-dashboard/");
}

type HeaderIconButtonProps = {
  "aria-label": string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  active?: boolean;
} & Pick<ComponentProps<"button">, "aria-expanded" | "aria-haspopup" | "aria-pressed">;

function HeaderIconButton({ "aria-label": ariaLabel, onClick, className, children, active, ...ariaRest }: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
        "border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]",
        "text-[hsl(var(--ink-2))] transition-colors",
        "hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--ink-1))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2",
        active && "border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]",
        className,
      )}
      {...ariaRest}
    >
      {children}
    </button>
  );
}

function HeaderThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <HeaderIconButton
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolvedTheme}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {isDark ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
          </motion.span>
        </AnimatePresence>
      </span>
    </HeaderIconButton>
  );
}

function NavPill({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        "text-[hsl(var(--ink-1))] hover:bg-[hsl(var(--surface-2))]",
        active && "bg-[hsl(var(--primary)/0.1)] font-semibold text-[hsl(var(--primary))]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const isSupremeAdmin = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const showNutriEcosystem = profile?.role === "nutritionist" || isSupremeAdmin;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const logoMarkGradId = useId();

  const notifWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchNotifications = async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn("[AppHeader] notifications fetch:", error.message);
        return;
      }

      setNotifications((data ?? []) as Notification[]);
    };

    void fetchNotifications();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notifWrapperRef.current && !notifWrapperRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showNotifications]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const markAsRead = async () => {
    if (!user || unreadCount === 0) return;

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id);

    if (error) {
      console.warn("[AppHeader] notifications mark as read:", error.message);
      return;
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  };

  const toggleNotifications = () => {
    if (!showNotifications) void markAsRead();
    setShowNotifications((prev) => !prev);
  };

  if (!user) return null;

  const pathname = location.pathname;
  const userInitials = getInitials(profile?.full_name, user.email ?? undefined);
  const settingsActive = isRouteActive(pathname, "/configuracoes");

  return (
    <header
      className="sticky top-0 z-50 h-16 w-full border-b border-[hsl(var(--surface-3)/0.8)] bg-[hsl(var(--surface-0)/0.92)] shadow-[0_1px_0_hsl(var(--primary)/0.06),0_4px_24px_hsl(var(--ink-1)/0.04)] backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={() => navigate("/inicio")}
          className="group flex h-7 min-w-0 items-center gap-2.5 rounded-lg text-left text-[hsl(var(--ink-1))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2"
        >
          <svg
            viewBox="0 0 40 32"
            className="h-7 w-9 shrink-0"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <defs>
              <linearGradient id={logoMarkGradId} x1="0" y1="0" x2="40" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--primary-light))" />
                <stop offset="1" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <text
              x="0"
              y="24"
              className="font-display"
              fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
              fontSize="20"
              fontWeight="800"
              fill={`url(#${logoMarkGradId})`}
            >
              NA
            </text>
            <circle cx="34" cy="8" r="3" className="fill-[hsl(var(--primary-glow))]" fillOpacity="0.95" />
            <path
              d="M4 30c2-4 4-6 7-6s5 2 7 6"
              className="stroke-[hsl(var(--primary))]"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
          <span
            className="font-display text-lg font-bold leading-7 tracking-[-0.03em] sm:text-xl"
            style={{ lineHeight: "28px" }}
          >
            <span className="text-[hsl(var(--ink-1))]">NutrI</span>
            <span className="text-brand">Aprova</span>
          </span>
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
          {isSupremeAdmin && (
            <button
              type="button"
              onClick={() => navigate("/admin-supremo")}
              aria-label="Admin Supremo"
              className={cn(
                "badge-gold inline-flex shrink-0 items-center gap-1.5",
                (isRouteActive(pathname, "/admin-supremo") || pathname.startsWith("/admin-supremo")) && "ring-1 ring-[hsl(var(--gold)/0.45)]",
              )}
            >
              <Crown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--gold))]" aria-hidden />
              <span className="hidden sm:inline" aria-hidden>
                Admin
              </span>
            </button>
          )}

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Navegação principal">
            <NavPill active={isRouteActive(pathname, "/inicio")} onClick={() => navigate("/inicio")}>
              <Home className="h-3.5 w-3.5" aria-hidden />
              <span>Início</span>
            </NavPill>
            <NavPill active={isRouteActive(pathname, "/blog")} onClick={() => navigate("/blog")}>
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              <span>Blog</span>
            </NavPill>
            <NavPill active={isRouteActive(pathname, "/comunidade")} onClick={() => navigate("/comunidade")}>
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span>Comunidade</span>
            </NavPill>
            {showNutriEcosystem && (
              <NavPill
                active={isNutriDashboardPath(pathname)}
                onClick={() => navigate("/nutri-dashboard")}
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Painel clínico</span>
                <span className="sm:hidden">Painel</span>
              </NavPill>
            )}
            {profile?.role === "personal_trainer" && (
              <NavPill
                active={isPersonalDashboardPath(pathname)}
                onClick={() => navigate("/personal-dashboard")}
              >
                <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                <span>PT Portal</span>
              </NavPill>
            )}
          </nav>

          <div
            className="flex min-w-0 max-w-[min(100%,28rem)] flex-nowrap items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
            aria-label="Navegação principal"
            role="navigation"
          >
            <NavPill active={isRouteActive(pathname, "/inicio")} onClick={() => navigate("/inicio")} className="shrink-0 px-2.5 sm:px-3.5">
              <Home className="h-3.5 w-3.5" aria-hidden />
              <span className="max-[380px]:sr-only">Início</span>
            </NavPill>
            <NavPill
              className="shrink-0 px-2.5 sm:px-3.5"
              active={isRouteActive(pathname, "/blog")}
              onClick={() => navigate("/blog")}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              <span className="max-[380px]:sr-only">Blog</span>
            </NavPill>
            <NavPill
              className="shrink-0"
              active={isRouteActive(pathname, "/comunidade")}
              onClick={() => navigate("/comunidade")}
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span className="max-w-[4.5rem] truncate sm:max-w-none">Comunidade</span>
            </NavPill>
            {showNutriEcosystem && (
              <NavPill
                className="shrink-0 px-2.5"
                active={isNutriDashboardPath(pathname)}
                onClick={() => navigate("/nutri-dashboard")}
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                <span className="max-[380px]:sr-only">Painel</span>
              </NavPill>
            )}
            {profile?.role === "personal_trainer" && (
              <NavPill
                className="shrink-0"
                active={isPersonalDashboardPath(pathname)}
                onClick={() => navigate("/personal-dashboard")}
              >
                <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                <span>PT</span>
              </NavPill>
            )}
          </div>

          {showNutriEcosystem && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[hsl(var(--coin-gold)/0.35)] bg-[hsl(var(--coin-gold)/0.1)] px-2.5 py-1">
              <Coins className="h-4 w-4 text-coin-gold" />
              <span className="text-sm font-semibold text-coin-gold-foreground tabular-nums">
                {profile?.credits ?? 0}
              </span>
            </div>
          )}

          <div className="relative shrink-0" ref={notifWrapperRef}>
              <HeaderIconButton
                aria-label="Notificações"
                onClick={toggleNotifications}
                active={showNotifications}
                className={cn("relative", showNotifications && "border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]")}
                aria-expanded={showNotifications}
                aria-haspopup="true"
              >
                <Bell className="h-4 w-4" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] font-bold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </HeaderIconButton>

              {showNotifications && (
                <div
                  className="card-clinical glass absolute right-0 top-full z-50 mt-2 min-w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl"
                  role="dialog"
                  aria-label="Notificações"
                >
                  <div className="flex items-center justify-between border-b border-[hsl(var(--surface-3))] px-4 py-3">
                    <p className="font-display text-sm font-bold text-[hsl(var(--ink-1))]">Notificações</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]"
                      onClick={() => setShowNotifications(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="max-h-64 divide-y divide-[hsl(var(--surface-3))] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[hsl(var(--ink-3))]">
                        Nenhuma notificação no momento.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={cn(
                            "cursor-pointer px-4 py-3 transition-colors hover:bg-[hsl(var(--surface-1))]",
                            !notif.read && "bg-[hsl(var(--primary)/0.06)]",
                            notif.read && "opacity-80",
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            {!notif.read && (
                              <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[hsl(var(--ink-1))]">{notif.title}</p>
                              <p className="mt-0.5 text-xs text-[hsl(var(--ink-2))]">{notif.message}</p>
                              <p className="mt-1.5 text-xs text-[hsl(var(--ink-3))]">
                                {formatNotificationTime(notif.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
          </div>

          <HeaderThemeToggle />

          <HeaderIconButton
            aria-label="Configurações"
            onClick={() => navigate("/configuracoes")}
            active={settingsActive}
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
          </HeaderIconButton>

          <div className="hidden min-w-0 max-w-[10rem] items-center gap-2.5 sm:flex">
            <div title={profile?.full_name || user.email || undefined}>
              <Avatar className="h-9 w-9 flex-shrink-0 border border-[hsl(var(--surface-3))] shadow-sm ring-offset-background">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="font-display bg-gradient-to-br from-primary to-primary/80 text-[13px] font-semibold text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="truncate text-sm text-[hsl(var(--ink-2))]">
              {profile?.full_name || user.email}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            className="h-9 shrink-0 gap-1.5 rounded-lg px-2 text-[hsl(var(--ink-2))] hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/20"
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
