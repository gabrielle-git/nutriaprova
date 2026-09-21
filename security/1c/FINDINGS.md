# Security 1C — Findings (baseline)

Nenhuma correção de RLS/migration/produto aplicada nesta etapa.

## VULN-1C-001 — Infinite recursion em policies de `profiles` (42P17)

- **Classificação:** VULNERABILIDADE CONFIRMADA
- **Evidência:** autenticação com JWT de usuário normal + qualquer operação cuja policy faça `EXISTS (SELECT 1 FROM profiles p WHERE p.role = 'admin')` → HTTP 500 / `42P17`
- **Reprodução mínima:** login C2 → `GET /rest/v1/profiles?select=user_id&user_id=eq.<C2>` → 500
- **Impacto:** bloqueia avaliação correta de SEC autenticados e controles positivos

## SEC-009 — Causa exata do 42501 (investigação, sem correção)

| Hipótese | Resultado |
|----------|-----------|
| Ausência de GRANT INSERT para `anon` | **FALSA** — `anon` tem INSERT |
| Policy de INSERT inexistente | **FALSA** — `invite_analytics_insert_any` existe, `WITH CHECK (true)`, roles `{anon,authenticated}` |
| Policy INSERT não aplicável | **FALSA** para o INSERT puro |
| Constraint/schema | **FALSA** — `sale` + `amount` aceitos quando INSERT completa |
| Outra causa | **VERDADEIRA** |

**Causa objetiva:** o cliente (supabase-js `.insert().select()` / PostgREST `Prefer: return=representation`) exige **RETURNING**, que é avaliado sob policies de **SELECT**. Não existe policy SELECT para `anon` em `invite_analytics` (só `invite_analytics_select_owner_or_admin` para `authenticated`). O Postgres rejeita a visibilidade da linha nova e reporta `42501` com mensagem genérica de RLS — **parece** falha de INSERT, mas o INSERT com `Prefer: return=minimal` retorna **HTTP 201** e a linha persiste.

**Categoria:** policy existente para INSERT, porém **não aplicável/inexistente para SELECT/RETURNING** do papel `anon`.

**Conclusão do teste SEC-009 (canônico, sem `.select()`):** INSERT fraudulento `sale`+`amount` por anon **é permitido** no baseline → **VULNERABILIDADE CONFIRMADA**.

## Confirmações adicionais (pós-matriz canônica)

- **SEC-010** — C1 INSERT `sale`+`amount` sem RETURNING → **VULNERABILIDADE CONFIRMADA**
- **SEC-011** — C1 INSERT `client_feedback` em R2 (pedido de C2) sem RETURNING → **VULNERABILIDADE CONFIRMADA**
- **SEC-008** — INSERT em `transactions` ainda **BLOQUEADO POR VULN-1C-001 / 42P17** porque a policy admin de INSERT avalia `profiles` (OR permissivo) e a recursão aborta a operação antes do WITH CHECK do próprio usuário
