# Security 1C — Fixtures de auditoria

Ambiente de fixtures sintéticos para a Etapa 1C (autorização/RLS).

## Escopo

- Cria usuários e `diet_requests` **somente** no Supabase Local da auditoria.
- Não altera `src/`, migrations, Edge Functions, RLS nem o schema do produto.
- Service role LOCAL é usada **apenas** para preparar fixtures. Testes SEC posteriores devem autenticar com JWT de usuário normal.

## Pré-requisitos

Stack isolada (já usada na 1C):

- diretório: `$HOME/nutriaprova-security-1c-local`
- API: `http://127.0.0.1:54321`
- DB: `127.0.0.1:54322`

A stack Docker histórica (`nutriaprova-n8n`, `nutriaprova-db`, etc.) é patrimônio de evidência e **não** deve ser tocada.

## Schema inspecionado (local pós-reset)

### `profiles`

| Coluna | Tipo | NOT NULL | Default / notas |
|--------|------|----------|-----------------|
| id | uuid | sim | `gen_random_uuid()` |
| user_id | uuid | sim | FK → `auth.users(id)`, UNIQUE |
| full_name | text | sim | `''` |
| role | text | sim | `'client'`; CHECK: client/nutritionist/admin/personal_trainer |
| credits | int | sim | `0` |
| crn_number | text | não | |
| approved | bool | sim | `false` |
| plan_tier | text | sim | `'basic'` |
| client_data | jsonb | sim | `'{}'` |
| deleted_at | timestamptz | não | soft delete |

Signup cria o profile via trigger `handle_new_user` a partir de `raw_user_meta_data.role`.

### `diet_requests`

| Coluna | Tipo | NOT NULL | Default / notas |
|--------|------|----------|-----------------|
| id | uuid | sim | `gen_random_uuid()` |
| client_id | uuid | sim | FK → `auth.users(id)` |
| nutritionist_id | uuid | não | FK → `auth.users(id)` |
| assigned_nutritionist_id | uuid | não | **sem** FK no schema atual |
| client_data | jsonb | não | |
| ai_draft | jsonb | não | |
| status | text | sim | `'pending'`; CHECK: awaiting_payment/processing/awaiting_validation/pending/in_review/completed |
| notes | text | não | |

### Outras tabelas inspecionadas (não seedadas nesta etapa)

- `transactions`: `user_id` NOT NULL (FK auth.users), `amount`, `type` default `credit_purchase`
- `client_feedback`: `diet_request_id`, `client_id`, `rating` 1–5
- `invite_analytics`: `code`, `event_type` IN (click/copy/sale)

## Fixtures criadas

| ID | Tipo | Detalhe |
|----|------|---------|
| C1 / C2 | client | emails `c1@local.test`, `c2@local.test` |
| N1 / N2 | nutritionist | `approved=true` (mínimo para uso em testes posteriores) |
| P1 | personal_trainer | `approved=true` |
| A1 | admin | `approved=true` |
| R1 | diet_request | owner C2, `status=pending`, `nutritionist_id=NULL`, `assigned_nutritionist_id=NULL` |
| R2 | diet_request | owner C2, `status=in_review`, `nutritionist_id=N2`, `assigned_nutritionist_id=N2` |

`client_data` em R1/R2 contém apenas JSON falso (ex.: nome sintético `Fixture Client C2`).

## Como rodar

A partir da **raiz do repositório** (precisa de `node_modules/@supabase/supabase-js`):

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_ANON_KEY="<anon key do supabase status local>"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key do supabase status local>"
# opcional; se omitido, o script gera senha sintética e grava só no runtime fora do Git
# export FIXTURE_PASSWORD="..."
export FIXTURE_RUNTIME_OUT="$HOME/nutriaprova-security-1c-local/runtime/fixtures.json"

node security/1c/scripts/setup-fixtures.mjs
```

Obter as keys locais (sem commitá-las):

```bash
cd "$HOME/nutriaprova-security-1c-local"
npx supabase@2.117.0 status -o env
```

## Runtime (não versionar)

IDs de usuários/requests e a senha sintética vão para `FIXTURE_RUNTIME_OUT` (padrão sugerido fora do repo).  
`security/1c/runtime/` também está no `.gitignore` caso alguém rode com path relativo.

## Fora de escopo nesta etapa

- Não executa SEC-001…SEC-011
- Não corrige vulnerabilidades
- Não modifica migrations / RLS / produto
