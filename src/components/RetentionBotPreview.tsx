import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bot, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MOCK_MESSAGES = [
  { from: "bot", text: "Olá! 🌿 Como foi sua adesão à dieta hoje?", time: "08:00" },
  { from: "user", text: "Segui o café da manhã e almoço certinho!", time: "08:02" },
  { from: "bot", text: "Excelente! 💪 Sua consistência está em 85% esta semana. Continue assim! Lembre-se do lanche da tarde: Iogurte Grego com Chia.", time: "08:02" },
  { from: "bot", text: "Dica do dia: Hidratação! Você já bebeu pelo menos 1L de água hoje? 💧", time: "12:00" },
];

export default function RetentionBotPreview() {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Daily Check-in Bot
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Preview
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Engajamento diário via WhatsApp/Notificação</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3 max-h-64 overflow-y-auto">
          {MOCK_MESSAGES.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.from === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border rounded-bl-sm"
              }`}>
                {msg.from === "bot" && (
                  <span className="text-xs font-semibold text-primary block mb-0.5">🤖 NutriBot</span>
                )}
                <p>{msg.text}</p>
                <p className="text-[10px] opacity-60 mt-1 text-right">{msg.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input placeholder="Responder..." className="text-sm" disabled />
          <Button size="sm" disabled>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
