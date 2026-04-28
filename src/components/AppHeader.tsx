import { type ComponentProps, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Bell, Settings, LogOut, X, Sun, Moon, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
      <span className="relative flex h-4 w-4 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isDark ? "moon" : "sun"}
            initial={{ y: -20, opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {isDark ? <Moon className="h-4 w-4" strokeWidth={2} /> : <Sun className="h-4 w-4" strokeWidth={2} />}
          </motion.div>
        </AnimatePresence>
      </span>
    </HeaderIconButton>
  );
}

export default function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const logoMarkGradId = useId();

  const { scrollY } = useScroll();
  const scrollYSpring = useSpring(scrollY, { stiffness: 380, damping: 45 });
  const headerBg = useTransform(scrollYSpring, [0, 80], ["hsl(var(--surface-0) / 0)", "hsl(var(--surface-0) / 0.95)"]);
  const headerBlur = useTransform(scrollYSpring, [0, 80], ["blur(0px)", "blur(20px)"]);
  const headerBorder = useTransform(scrollYSpring, [0, 80], ["hsl(var(--surface-3) / 0)", "hsl(var(--surface-3) / 0.8)"]);
  const headerShadow = useTransform(scrollYSpring, [0, 80], [
    "0px 0px 0px hsl(0 0% 0% / 0)",
    "0px 8px 32px hsl(var(--ink-1) / 0.08)",
  ]);

  const notifWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchNotifications = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela `notifications` fora do schema tipado
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela `notifications` fora do schema tipado
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

  const userInitials = getInitials(profile?.full_name, user.email ?? undefined);

  return (
    <motion.header
      className="sticky top-0 z-50 h-16 w-full backdrop-saturate-150"
      style={{
        backgroundColor: headerBg,
        backdropFilter: headerBlur,
        WebkitBackdropFilter: headerBlur,
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: headerBorder,
        boxShadow: headerShadow,
      }}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex h-7 min-w-0 items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2"
        >
          <motion.div
            className="flex min-w-0 items-center gap-2.5"
            initial={{ opacity: 0, x: -30, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
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
            <span className="flex min-w-0 items-center gap-2" style={{ lineHeight: "28px" }}>
              <span className="font-display text-lg font-black tracking-tighter text-[hsl(var(--ink-1))] sm:text-xl">
                NutrI
              </span>
              <span className="font-display text-lg font-black tracking-tighter sm:text-xl text-brand-animated">Aprova</span>
              <span className="badge-live text-xs min-h-[1em]" aria-hidden />
            </span>
          </motion.div>
        </button>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
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
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    key={unreadCount}
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 15 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="badge-live absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-0.5 text-[10px] font-bold leading-none text-white"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </HeaderIconButton>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.94, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, scale: 0.96, filter: "blur(4px)" }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-ultra card-clinical absolute right-0 top-full z-50 mt-2 min-w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius)] shadow-xl"
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
                      notifications.map((notif, index) => (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          whileHover={{ x: 4, backgroundColor: "hsl(var(--surface-1))" }}
                          className={cn(
                            "cursor-pointer px-4 py-3",
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
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <HeaderThemeToggle />

          <div className="flex min-w-0 max-w-[11rem] items-center gap-2 sm:max-w-[14rem]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={profile?.full_name || user.email || undefined}
                  className="rounded-full outline-none ring-offset-background transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2"
                  aria-label="Menu da conta"
                >
                  <Avatar className="h-9 w-9 flex-shrink-0 border border-[hsl(var(--surface-3))] shadow-sm">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="font-display bg-gradient-to-br from-primary to-primary/80 text-[13px] font-semibold text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))]"
              >
                <DropdownMenuLabel className="truncate font-normal text-[hsl(var(--ink-2))]">
                  {profile?.full_name || user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[hsl(var(--surface-3))]" />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 focus:bg-[hsl(var(--surface-2))]"
                  onClick={() => navigate("/blog")}
                >
                  <BookOpen className="h-4 w-4" strokeWidth={2} />
                  Blog
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 focus:bg-[hsl(var(--surface-2))]"
                  onClick={() => navigate("/comunidade")}
                >
                  <Users className="h-4 w-4" strokeWidth={2} />
                  Comunidade
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[hsl(var(--surface-3))]" />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 focus:bg-[hsl(var(--surface-2))]"
                  onClick={() => navigate("/configuracoes")}
                >
                  <Settings className="h-4 w-4" strokeWidth={2} />
                  Editar perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:bg-red-500/10 focus:text-destructive"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden min-w-0 truncate text-sm text-[hsl(var(--ink-2))] md:inline">
              {profile?.full_name || user.email}
            </span>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
