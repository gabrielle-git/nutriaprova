import { useNavigate, useLocation } from "react-router-dom";
import { Home, Utensils, Users, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Início", icon: Home, path: "/" },
  { label: "Dieta", icon: Utensils, path: "/?tab=dieta" },
  { label: "Comunidade", icon: Users, path: "/comunidade" },
  { label: "Perfil", icon: User, path: "/configuracoes" },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => {
    const base = path.split("?")[0];
    if (base === "/") return location.pathname === "/" && !location.search.includes("tab=");
    return location.pathname === base;
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação inferior"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ label, icon: Icon, path }) => {
          const active = isActive(path);
          return (
            <li key={label}>
              <button
                onClick={() => navigate(path)}
                className={cn(
                  "w-full flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
