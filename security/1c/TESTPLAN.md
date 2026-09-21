# Security 1C — Plano canônico SEC-001…SEC-011

Matriz **exata** do pacote de auditoria (não renumerar; controles não são SEC).

## Classificação

| Valor | Significado |
|-------|-------------|
| VULNERABILIDADE CONFIRMADA | Baseline permitiu o que o hardening deve negar |
| BLOQUEADA | Deny limpo (0 linhas / rejeição RLS esperada) |
| BLOQUEADO POR VULN-1C-001 / 42P17 | Operação autenticada nem chegou a ser avaliada (recursão em `profiles`) |
| NÃO CONFIRMADA | Ambíguo sem bloqueio 42P17 |

## SEC-001 → SEC-011

| ID | Identidade | Operação |
|----|------------|----------|
| SEC-001 | C1 | SELECT da request **R1** pertencente a C2 no pool público |
| SEC-002 | P1 | SELECT da mesma **R1** |
| SEC-003 | C1 | UPDATE/claim da **R1** |
| SEC-004 | P1 | UPDATE/claim da **R1** |
| SEC-005 | C1 | altera próprio `profiles.role` |
| SEC-006 | C1 | altera próprio `profiles.credits` |
| SEC-007 | C1 | altera próprio `profiles.plan_tier` |
| SEC-008 | C1 | INSERT arbitrário em `transactions` |
| SEC-009 | anon | INSERT fraudulento `sale` + `amount` em `invite_analytics` |
| SEC-010 | C1 | INSERT fraudulento `sale` + `amount` em `invite_analytics` |
| SEC-011 | C1 | INSERT `client_feedback` apontando para request de C2 (R2) |

## Controles (não são SEC)

| ID | Tipo | Descrição |
|----|------|-----------|
| CTRL-POS-01 | positivo | C2 SELECT próprios R1+R2 |
| CTRL-POS-02 | positivo | N2 SELECT R2 |
| CTRL-POS-03 | positivo | N2 UPDATE notes de R2 |
| CTRL-POS-04 | positivo | A1 SELECT R1+R2 |
| CTRL-NEG-01 | negativo | C1 SELECT profile de C2 |
| CTRL-NEG-02 | negativo | N1 SELECT R2 (pedido de N2) |

## Execução

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_ANON_KEY="..."
export FIXTURE_RUNTIME_IN="$HOME/nutriaprova-security-1c-local/runtime/fixtures.json"
node security/1c/scripts/run-sec-suite.mjs
```

SEC-009 é executado de forma isolada (cliente anon, sem sessão) e **sem** `Prefer: return=representation` / `.select()`, para não confundir falha de SELECT RLS com falha de INSERT.
