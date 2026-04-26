import AppHeader from "@/components/AppHeader";
import NutritionistDashboard from "@/components/NutritionistDashboard";

export default function NutriDashboardPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--surface-0))]">
      <AppHeader />
      <NutritionistDashboard />
    </div>
  );
}
