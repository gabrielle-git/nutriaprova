import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

type Role = "client" | "nutritionist" | "personal_trainer" | "admin";

interface RouteGuardProps {
  children: ReactNode;
  allow?: Role[]; // allowed roles; admin/supreme always bypasses
  requireAuth?: boolean;
}

export default function RouteGuard({ children, allow, requireAuth = true }: RouteGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();

  // Dois cenários distintos de bloqueio — tratamento DIFERENTE para cada um:
  //  - missingAuth: usuária não está logada → manda para /auth (login).
  //  - roleMismatch: usuária logada com papel incompatível → manda para "/"
  //    (Home). Mandar para /auth aqui criava loop, porque /auth (quando há
  //    sessão e nenhuma intenção na URL) redireciona de volta para o
  //    dashboard do papel atual, que é justamente o que ela está tentando
  //    escapar. A Home quebra esse loop e dá um ponto neutro de retorno.
  const missingAuth = !loading && requireAuth && !user;
  const roleMismatch =
    !loading &&
    !!user &&
    !isSupreme &&
    !!allow &&
    !!profile?.role &&
    !allow.includes(profile.role as Role);
  const blocked = missingAuth || roleMismatch;

  useEffect(() => {
    if (!blocked) return;
    if (missingAuth) {
      toast.error("Faça login", {
        description: "Você precisa estar autenticada para acessar esta página.",
      });
    } else {
      toast.error("Acesso restrito ao seu perfil", {
        description: "Esta área é destinada a outro tipo de usuário.",
      });
    }
  }, [blocked, missingAuth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (missingAuth) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (roleMismatch) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
