import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import RouteGuard from "@/components/RouteGuard";
import PageTransition from "@/components/PageTransition";

// Páginas públicas
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ConfirmarNomeCompleto from "./pages/ConfirmarNomeCompleto";
import OnboardingNutri from "./pages/OnboardingNutri";
import NutricionistasLanding from "./pages/NutricionistasLanding";
import RecuperarSenha from "./pages/RecuperarSenha";
import ResetPassword from "./pages/ResetPassword";
import Blog from "./pages/Blog";
import PersonalTrainer from "./pages/PersonalTrainer"; // landing pública /personal-trainer
import Planos from "./pages/Planos";
import NotFound from "./pages/NotFound";
import InicioPage from "./pages/InicioPage";

// Páginas autenticadas
import Configuracoes from "./pages/Configuracoes";
import Comunidade from "./pages/Comunidade";
import CadastroPix from "./pages/CadastroPix";
import NutriBemVindo from "./pages/NutriBemVindo";
import BemVindoPersonal from "./pages/BemVindoPersonal"; // boas-vindas do personal
import PersonalDashboard from "./pages/PersonalDashboard"; // dashboard real com Supabase
import ClientDashboardPage from "./pages/ClientDashboardPage";
import ClientQuestionnairePage from "./pages/ClientQuestionnairePage";
import NutriDashboardPage from "./pages/NutriDashboardPage";

// Admin
import Admin from "./pages/Admin";
import AdminSupremo from "./pages/AdminSupremo";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
      {/* ── Públicas ─────────────────────────────────────────────── */}
      <Route path="/"                    element={<PageTransition><Index /></PageTransition>} />
      <Route path="/auth"                element={<PageTransition><Auth /></PageTransition>} />
      <Route path="/cadastro"            element={<PageTransition><Auth /></PageTransition>} />
      <Route path="/auth/callback"       element={<PageTransition><AuthCallback /></PageTransition>} />
      <Route path="/confirmar-nome-completo" element={
        <RouteGuard>
          <PageTransition><ConfirmarNomeCompleto /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/onboarding" element={
        <RouteGuard>
          <PageTransition><OnboardingNutri /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/para-nutricionistas" element={<PageTransition><NutricionistasLanding /></PageTransition>} />
      <Route path="/recuperar-senha"     element={<PageTransition><RecuperarSenha /></PageTransition>} />
      <Route path="/reset-password"      element={<PageTransition><ResetPassword /></PageTransition>} />
      <Route path="/blog"                element={<PageTransition><Blog /></PageTransition>} />
      <Route path="/personal-trainer"    element={<PageTransition><PersonalTrainer /></PageTransition>} />
      <Route path="/planos"              element={<PageTransition><Planos /></PageTransition>} />

      {/* ── Boas-vindas (pós-cadastro) ───────────────────────────── */}
      <Route path="/bem-vindo-nutri" element={
        <RouteGuard allow={["nutritionist", "admin"]}>
          <PageTransition><NutriBemVindo /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/bem-vindo-personal" element={
        <RouteGuard allow={["personal_trainer", "admin"]}>
          <PageTransition><BemVindoPersonal /></PageTransition>
        </RouteGuard>
      } />

      {/* ── Autenticadas ─────────────────────────────────────────── */}
      <Route path="/inicio" element={
        <RouteGuard>
          <PageTransition><InicioPage /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/configuracoes" element={
        <RouteGuard>
          <PageTransition><Configuracoes /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/personal" element={
        <RouteGuard allow={["personal_trainer", "admin"]}>
          <PageTransition><PersonalDashboard /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/personal-dashboard" element={
        <RouteGuard allow={["personal_trainer", "admin"]}>
          <PageTransition><PersonalDashboard /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/dashboard" element={
        <RouteGuard allow={["client", "admin"]}>
          <PageTransition><ClientDashboardPage /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/questionnaire" element={
        <RouteGuard allow={["client", "admin"]}>
          <PageTransition><ClientQuestionnairePage /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/nutri-dashboard" element={
        <RouteGuard allow={["nutritionist", "admin"]}>
          <PageTransition><NutriDashboardPage /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/comunidade" element={
        <RouteGuard>
          <PageTransition><Comunidade /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/cadastro-pix" element={
        <RouteGuard allow={["nutritionist", "admin"]}>
          <PageTransition><CadastroPix /></PageTransition>
        </RouteGuard>
      } />

      {/* ── Admin ────────────────────────────────────────────────── */}
      <Route path="/admin" element={
        <RouteGuard allow={["admin"]}>
          <PageTransition><Admin /></PageTransition>
        </RouteGuard>
      } />
      <Route path="/admin-supremo" element={
        <RouteGuard allow={["admin"]}>
          <PageTransition><AdminSupremo /></PageTransition>
        </RouteGuard>
      } />

      <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnimatedRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;