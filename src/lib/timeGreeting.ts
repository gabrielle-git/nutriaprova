/** Saudação pela hora local do dispositivo (getHours 0–23). */
export function getTimeGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 0 && h <= 11) return "Bom dia";
  if (h >= 12 && h <= 17) return "Boa tarde";
  return "Boa noite";
}
