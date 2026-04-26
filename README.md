# NutrIAprova

Plataforma SaaS premium de saúde nutricional com geração de cardápios por IA, validação profissional e funil de conversão com paywall visual.

## Visão Geral

O NutrIAprova conecta 3 públicos em um único produto:

- Paciente: responde questionário, recebe plano personalizado e desbloqueia via checkout.
- Nutricionista: revisa, ajusta com IA e valida o plano com assinatura profissional.
- Admin: acompanha operações, qualidade e indicadores da plataforma.

A proposta central é combinar experiência clínica com automação:

- IA para velocidade de geração.
- Validação CRN para segurança.
- Jornada orientada a conversão (questionário -> curiosidade -> paywall -> desbloqueio).

## Stack Tecnológica

- Frontend: React 18, TypeScript, Vite 5, React Router DOM, Tailwind CSS, shadcn/ui, Framer Motion.
- Estado e dados: React Query + Supabase JS.
- Backend/Banco/Auth: Supabase (PostgreSQL, RLS, Auth PKCE, Realtime).
- Orquestração de IA: n8n (webhooks de geração e ajuste).
- Modelo de IA: Google Gemini (Gemini 2.0 Flash) integrado dentro dos workflows do n8n.
- Infra local de apoio: Docker Compose (Postgres app, Postgres n8n, n8n, Redis, Ollama).

## Arquitetura de Alto Nível

1) O frontend envia dados do cliente para o n8n:
- `POST /webhook/gerar-dieta` para plano inicial.
- `POST /webhook/ajustar-dieta` para ajustes guiados por prompt.

2) O n8n processa o fluxo de IA (incluindo chamada ao Gemini 2.0 Flash), normaliza o payload de dieta e retorna para o frontend.

3) O frontend persiste e consulta ciclo de vida do plano em `diet_requests` no Supabase.

4) O nutricionista consome o rascunho (`ai_draft`), aplica ajustes quando necessário e conclui validação.

## Regras de Negócio (Alto Nível)

### RBAC (controle de acesso)

- `client`: jornada de questionário, pagamento e consumo de plano.
- `nutritionist`: fila de validações, revisão técnica e ajustes com IA.
- `personal_trainer`: área específica de afiliados/indicação.
- `admin`: acesso operacional ampliado.

As permissões de leitura/escrita são reforçadas por RLS no Supabase.

### Geração de cardápios por IA

- Fonte oficial no frontend: `src/services/n8nService.ts`.
- O cliente envia `clientData` (peso, altura, objetivo, alergias etc.) para n8n.
- O n8n orquestra o pipeline de IA com Gemini 2.0 Flash e retorna `DietPlan`.
- O contrato de resposta inclui refeições fixas e macros numéricas.

### Fluxo de Paywall (blur state)

- Após o questionário, o plano entra no funil com status de pagamento pendente.
- O cardápio é renderizado com blur e bloqueio de interação.
- CTA central abre checkout (mock) para desbloqueio.
- Após aprovação, o status evolui para processamento/validação e o tracker visual acompanha:
  - Pagamento confirmado
  - Processando IA
  - Validação nutricionista (CRN)
  - Download liberado

## Estrutura Resumida

- `src/components/ClientOnboarding.tsx`: questionário e início do funil do paciente.
- `src/components/ClientDashboard.tsx`: dashboard do paciente, paywall e histórico.
- `src/components/NutritionistDashboard.tsx`: operação do nutricionista.
- `src/components/DietProgressTracker.tsx`: timeline de status do plano.
- `src/services/n8nService.ts`: cliente HTTP para webhooks n8n.
- `src/integrations/supabase/`: client e tipagens do Supabase.
- `supabase/migrations/`: evolução de schema/RLS.
- `docker-compose.yml`: stack local de infraestrutura.

## Execução Local (Debian 12+)

### 1) Pré-requisitos

Instale dependências de sistema:

```bash
sudo apt update
sudo apt install -y git curl build-essential ca-certificates gnupg lsb-release
```

Instale Node.js 20+ (recomendado via nvm):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
nvm use 20
node -v
npm -v
```

Instale Docker e Compose Plugin:

```bash
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

### 2) Clonar e instalar pacotes

```bash
git clone <URL_DO_REPOSITORIO>
cd nutriaprova-saas-leads-main
npm install
```

### 3) Variáveis de ambiente

Crie/edite os arquivos `.env` e `.env.local` com os valores do seu ambiente.

Variáveis mínimas de frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Variáveis usadas na infraestrutura Docker (`docker-compose.yml`):

- `APP_DB_PASSWORD`
- `N8N_DB_PASSWORD`
- `N8N_PASSWORD`
- `N8N_ENCRYPTION_KEY`
- `REDIS_PASSWORD`
- opcionais: `N8N_USER`, `N8N_HOST`, `N8N_WEBHOOK_URL`, `N8N_EDITOR_URL`, `TZ`.

### 4) Subir infraestrutura local

```bash
docker compose up -d
docker compose ps
```

Serviços esperados:

- n8n: `http://localhost:5678`
- Postgres app: `localhost:5433`
- Redis: `localhost:6379`
- Ollama: `localhost:11434`

### 5) Rodar frontend

```bash
npm run dev
```

App disponível em:

- `http://localhost:8080`

### 6) Build e validação

```bash
npm run lint
npm run test
npm run build
npm run preview
```

## Deploy (Produção)

### Estratégia recomendada

- Frontend (Vite build estático): Vercel, Netlify, Cloudflare Pages ou Nginx.
- Supabase: projeto cloud com migrations aplicadas e RLS ativo.
- n8n: instância dedicada (VM/container), com credenciais seguras e HTTPS.
- IA (Gemini 2.0 Flash): credencial configurada no n8n (não no frontend).

### Fluxo de deploy sugerido

1. Aplicar migrations no Supabase.
2. Publicar frontend com variáveis `VITE_*` de produção.
3. Publicar n8n com autenticação, HTTPS e persistência.
4. Atualizar webhooks no n8n para os endpoints esperados pelo frontend.
5. Validar e2e dos fluxos:
   - cadastro/login
   - questionário -> paywall
   - pagamento -> tracker
   - revisão/validação do nutricionista

## Deploy em Debian (self-hosted)

### Frontend via Nginx (estático)

```bash
npm ci
npm run build
sudo mkdir -p /var/www/nutriaprova
sudo cp -r dist/* /var/www/nutriaprova/
```

Exemplo de server block Nginx:

```nginx
server {
  listen 80;
  server_name seu-dominio.com;

  root /var/www/nutriaprova;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Depois:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### n8n/infra no Debian

Use o `docker-compose.yml` do projeto em host dedicado ou stack separada, com:

- reverse proxy HTTPS (Nginx/Traefik/Caddy),
- backup de volumes (`n8n_data`, bancos, redis),
- rotação de logs e monitoramento.

## Observações de Segurança

- Nunca exponha chaves sensíveis no frontend.
- Restrinja CORS e origens no n8n.
- Use HTTPS em todos os pontos externos.
- Ative políticas de senha forte e MFA para admins.
- Mantenha RLS revisado após cada migration.

## Licença e Uso

Projeto privado de produto SaaS. Uso sujeito às políticas internas da equipe do NutrIAprova.