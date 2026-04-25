import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, Bell, Settings, LogOut, Coins, Crown, X, Dumbbell, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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

export default function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const isSupremeAdmin = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Ref no wrapper do sininho + dropdown. Se o clique cair fora, fechamos.
  // Isso também torna o comportamento resiliente ao clique em qualquer
  // elemento da página, incluindo outros botões do header.
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
      if (
        notifWrapperRef.current &&
        !notifWrapperRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };

    // mousedown (não 'click') para fechar antes que outros handlers disparem.
    document.addEventListener("mousedown", handleClickOutside);

    // Também fecha ao pressionar ESC — padrão de acessibilidade.
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

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  };

  const toggleNotifications = () => {
    if (!showNotifications) void markAsRead();
    setShowNotifications((prev) => !prev);
  };

  if (!user) return null;

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
        <Leaf className="h-5 w-5 text-primary" />
        <span className="font-display font-bold">Nutr<span className="text-primary">IA</span>prova</span>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isSupremeAdmin && (
          <Button
            size="sm"
            onClick={() => navigate("/admin-supremo")}
            className="gap-1.5 bg-card text-primary border border-primary/30 hover:bg-primary/10"
          >
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">Admin Supremo</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate("/comunidade")}
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Comunidade</span>
        </Button>

        {/* PT Portal — exclusivo do Personal Trainer.
            RBAC: Nutri e admin comum NÃO veem este atalho para manter o painel
            do Nutri focado apenas nas ferramentas de nutrição. */}
        {profile?.role === "personal_trainer" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/personal-dashboard")}
            className="gap-1.5 hidden md:inline-flex"
          >
            <Dumbbell className="h-4 w-4" />
            <span className="hidden sm:inline">PT Portal</span>
          </Button>
        )}

        {profile?.role === "nutritionist" && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--coin-gold)/.1)] border border-[hsl(var(--coin-gold)/.3)]">
            <Coins className="h-4 w-4 text-coin-gold" />
            <span className="text-sm font-semibold text-coin-gold-foreground">{profile.credits}</span>
          </div>
        )}

        {/* Notifications Bell */}
        <div className="relative" ref={notifWrapperRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={toggleNotifications}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-display font-bold text-sm">Notificações</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNotifications(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma notificação no momento.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-border/50 last:border-0 ${
                        !notif.read ? "bg-accent/30" : "opacity-70"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!notif.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
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

        {/* Settings */}
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <Settings className="h-4 w-4" />
        </Button>

        <span className="text-sm text-muted-foreground hidden md:inline">{profile?.full_name || user.email}</span>

        {/* Sair — visível e com texto para facilitar troca de conta durante testes */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="gap-1.5 border-border/70"
          aria-label="Sair da conta"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
