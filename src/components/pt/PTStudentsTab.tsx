import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, CheckCircle2, Clock } from "lucide-react";

interface Student {
  name: string;
  email: string;
  status: "convertido" | "pendente";
  paid: boolean;
  date: string;
}

export default function PTStudentsTab({ students }: { students: Student[] }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Alunos Indicados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "convertido" ? "default" : "outline"}>
                    {s.status === "convertido" ? "Convertido" : "Pendente"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {s.paid ? (
                    <span className="flex items-center gap-1 text-primary text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Clock className="h-3.5 w-3.5" /> Aguardando
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
