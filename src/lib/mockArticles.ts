// Seed/mock articles shown on the public blog. These are static and cannot be
// edited or deleted — they simply enrich the /blog page until real CMS content
// is published. Real DB posts are merged on top of these.

export interface MockArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string;
  read_time: string;
  featured: boolean;
  published: boolean;
  status: "published";
  author_id: string;
  created_at: string;
  isMock: true;
}

const ctaLine =
  "\n\n---\n\n👉 Quer aplicar isso na prática com um plano feito por IA + validação de um Nutricionista com CRN? **Valide sua dieta por R$ 39,90** e receba seu cardápio personalizado em minutos.";

export const MOCK_ARTICLES: MockArticle[] = [
  {
    id: "mock-jejum-intermitente",
    slug: "5-mitos-sobre-jejum-intermitente",
    title: "5 Mitos sobre o Jejum Intermitente que a Ciência já desmentiu",
    excerpt:
      "Jejum acelera o metabolismo? Faz perder massa muscular? Separamos os principais mitos e o que realmente diz a ciência atual.",
    content: `O jejum intermitente virou febre nas redes sociais — mas com tanta informação circulando, é fácil confundir o que é fato com o que é apenas modismo. Vamos aos cinco maiores mitos.

**Mito 1: Jejum acelera o metabolismo de forma mágica.**
Estudos publicados no *American Journal of Clinical Nutrition* mostram que o gasto energético basal sofre apenas pequenas variações em jejuns de até 72 horas. O efeito real vem do déficit calórico, não do "modo turbo" do corpo.

**Mito 2: Você perde massa muscular se ficar 16 horas sem comer.**
Falso. Pesquisas com protocolos 16:8 mostram preservação de massa magra quando há ingestão adequada de proteína (1,6 a 2,2g por kg) na janela alimentar e treino de força regular.

**Mito 3: Jejum serve para todo mundo.**
Não. Gestantes, lactantes, pessoas com histórico de transtornos alimentares e diabéticos tipo 1 devem evitar protocolos restritivos sem acompanhamento profissional.

**Mito 4: Café com manteiga "quebra" o jejum.**
Tecnicamente sim — qualquer caloria interrompe o estado de jejum metabólico. Mas para quem busca apenas controle de fome e foco, o impacto é mínimo.

**Mito 5: Jejum cura tudo, do diabetes à depressão.**
Há evidências promissoras para sensibilidade à insulina e marcadores inflamatórios, mas o jejum não substitui tratamento médico. É uma ferramenta, não uma panaceia.${ctaLine}`,
    category: "Ciência",
    cover_image_url:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
    read_time: "6 min",
    featured: true,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    isMock: true,
  },
  {
    id: "mock-ia-na-nutricao",
    slug: "como-a-ia-esta-mudando-a-nutricao",
    title: "Como a Inteligência Artificial está mudando a Nutrição em 2026",
    excerpt:
      "De cardápios gerados em segundos à análise preditiva de adesão, a IA está redefinindo o consultório do nutricionista moderno.",
    content: `A nutrição sempre foi uma ciência baseada em dados — calorias, macros, micronutrientes, biomarcadores. O que mudou em 2026 é a velocidade com que esses dados podem ser cruzados, interpretados e personalizados.

**1. Cardápios em segundos, não em horas.**
O que antes levava 2 a 3 horas de planejamento manual hoje é gerado em menos de 30 segundos por modelos como o Gemini e o GPT-5, que consideram preferências, restrições, orçamento e contexto cultural do paciente.

**2. Análise preditiva de adesão.**
Sistemas modernos cruzam histórico alimentar, padrões comportamentais e até dados de wearables para prever quem tem maior risco de abandonar a dieta — permitindo intervenção precoce do profissional.

**3. O nutricionista como curador, não como digitador.**
A IA não substitui o CRN. O que ela faz é liberar o profissional do trabalho mecânico para focar no que humano nenhum algoritmo faz: empatia, escuta clínica e ajuste fino baseado em vivência.

**4. Democratização do acesso.**
Plataformas como a nutrIAprova permitem que qualquer pessoa tenha acesso a um plano alimentar profissional por R$ 39,90 — algo impensável há 5 anos, quando uma consulta custava R$ 300+.

**5. O futuro: nutrição preditiva + genômica.**
A próxima fronteira já está sendo testada: cruzar dados genéticos, microbioma intestinal e padrões alimentares para prescrever cardápios verdadeiramente individuais.${ctaLine}`,
    category: "Tecnologia",
    cover_image_url:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    read_time: "7 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    isMock: true,
  },
  {
    id: "mock-macros-ganho-massa",
    slug: "importancia-dos-macros-para-ganho-de-massa",
    title: "A importância dos Macros para Ganho de Massa Muscular",
    excerpt:
      "Proteína, carboidrato e gordura na proporção certa fazem a diferença entre estagnar e crescer. Veja o guia prático.",
    content: `Treinar pesado sem comer certo é como pisar no acelerador com o tanque vazio. Vamos ao essencial sobre macronutrientes para hipertrofia.

**Proteína: o tijolo do músculo.**
A recomendação atual para indivíduos em treinamento de força é de 1,6 a 2,2 g por kg de peso corporal por dia. Para alguém de 75 kg, isso significa entre 120 e 165 g — o equivalente a 4-5 refeições com 30 g de proteína cada.

**Carboidrato: o combustível.**
Sem carbo, sem treino intenso. A faixa ideal varia entre 4 e 6 g/kg para quem busca ganho de massa, priorizando fontes de baixo a médio índice glicêmico (arroz, batata-doce, aveia, frutas) e concentrando uma porção maior no pré e pós-treino.

**Gordura: hormônios e saciedade.**
Não corte gordura. Mantenha entre 0,8 e 1,2 g/kg, com foco em fontes saudáveis: azeite extravirgem, abacate, castanhas, peixes gordos e ovos inteiros. Gordura é fundamental para produção de testosterona.

**Superávit calórico controlado.**
Para ganhar massa magra com mínimo de gordura, mantenha um superávit de 200 a 400 kcal acima do seu gasto total. Mais que isso = ganho de gordura desnecessário.

**Timing importa, mas menos do que você pensa.**
A "janela anabólica" é mais larga do que se acreditava. O total diário de proteína e calorias importa mais do que o horário exato — desde que você tenha uma refeição decente até 2h após o treino.

**Resumo prático para 75 kg ganhando massa:**
- Proteína: 150 g
- Carboidrato: 350 g
- Gordura: 75 g
- Total: ~2.700 kcal/dia${ctaLine}`,
    category: "Performance",
    cover_image_url:
      "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?auto=format&fit=crop&w=1200&q=80",
    read_time: "5 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    isMock: true,
  },
  {
    id: "mock-whey-protein-guia",
    slug: "guia-definitivo-whey-protein",
    title: "O Guia Definitivo do Whey Protein: Necessidade ou Luxo?",
    excerpt:
      "Whey é obrigatório para crescer? Concentrado, isolado ou hidrolisado? Entenda quando vale a pena investir e quando é só marketing.",
    content: `O whey protein virou sinônimo de academia — mas será que todo mundo precisa dele? A resposta curta: depende do seu consumo total de proteína.

**O que é, afinal, o whey?**
É a proteína extraída do soro do leite, com altíssimo valor biológico (rico em BCAAs, especialmente leucina) e absorção rápida. É o suplemento mais estudado da indústria fitness.

**Concentrado, isolado ou hidrolisado: qual escolher?**
- **Concentrado (WPC):** 70-80% proteína, custo-benefício imbatível, contém um pouco de lactose e gordura. Ideal para 90% das pessoas.
- **Isolado (WPI):** 90%+ proteína, baixíssima lactose. Vale para intolerantes ou em fases de cutting agressivo.
- **Hidrolisado (WPH):** Pré-digerido, absorção ultra-rápida. Caro e com sabor amargo — só vale para atletas de elite ou pós-treino imediato.

**Quanto tomar?**
A meta é o total diário de proteína (1,6-2,2 g/kg). Se você já come ovos, frango, carne e iogurte suficientes, **não precisa de whey**. Ele é apenas uma forma prática e barata de bater a meta — não um milagre anabólico.

**Quando o whey é realmente útil:**
- Pós-treino, quando comida sólida não cabe
- Café da manhã rápido
- Lanches em viagem ou trabalho
- Pessoas com pouco apetite

**Quando NÃO é necessário:**
- Quem já consome 2g/kg de proteína na comida
- Crianças e adolescentes (priorizar comida)
- Quem busca emagrecimento sem treino de força

**Veredito:** Whey é prático, seguro e barato — mas não é mágico. Comida de verdade vem primeiro.${ctaLine}`,
    category: "Performance",
    cover_image_url:
      "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=1200&q=80",
    read_time: "6 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
    isMock: true,
  },
  {
    id: "mock-creatina-suplemento",
    slug: "creatina-suplemento-mais-estudado",
    title: "Creatina: O suplemento mais estudado do mundo e seus benefícios reais",
    excerpt:
      "Mais de 700 estudos e décadas de pesquisa confirmam: creatina é segura, eficaz e barata. Veja por que ela é praticamente unanimidade.",
    content: `Se houvesse um Hall da Fama dos suplementos, a creatina ocuparia o primeiro lugar. Mais de 700 estudos publicados, décadas de uso e um perfil de segurança raro em qualquer substância.

**O que é a creatina?**
Um composto naturalmente produzido pelo corpo (fígado, rins, pâncreas) e presente em carnes vermelhas e peixes. Sua função: regenerar ATP, a "moeda energética" das células musculares.

**Benefícios comprovados:**
1. **Aumento de força e potência** — média de 5-15% em exercícios de alta intensidade.
2. **Ganho de massa muscular** — 1-2 kg em 4-8 semanas, parte por volume celular, parte por hipertrofia real.
3. **Melhora cognitiva** — estudos recentes mostram benefícios em memória e fadiga mental, especialmente em vegetarianos.
4. **Suporte à recuperação** — reduz danos musculares pós-treino.
5. **Saúde óssea e neurológica** — evidências promissoras em idosos.

**Como tomar?**
- **Dose padrão:** 3-5 g por dia, todos os dias, em qualquer horário. Não precisa ciclar.
- **Saturação opcional:** 20 g/dia (4x5g) por 5-7 dias para encher os estoques mais rápido.
- **Com o quê?** Água, suco, shake — tanto faz. O mito do "tomar com carbo" é exagerado.

**Mitos que precisam morrer:**
- ❌ "Faz mal pros rins" — falso em pessoas saudáveis (centenas de estudos confirmam).
- ❌ "Causa retenção de líquido feia" — a retenção é INTRACELULAR (dentro do músculo), o que é desejável.
- ❌ "Tem que ser monohidratada importada" — qualquer creatina monohidratada com selo Creapure ou similar serve.

**Quem deve evitar:**
Pessoas com doença renal pré-existente devem consultar médico. Para todos os outros: é segura.

**Veredito:** Se você treina força e busca resultado, a creatina é provavelmente o melhor R$ 50/mês que você pode investir.${ctaLine}`,
    category: "Performance",
    cover_image_url:
      "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=1200&q=80",
    read_time: "7 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    isMock: true,
  },
  {
    id: "mock-rotulos-alimentos",
    slug: "como-ler-rotulos-de-alimentos",
    title: "Como ler rótulos de alimentos sem ser enganado pela indústria",
    excerpt:
      '"Zero açúcar", "natural", "fit", "integral" — descubra o que esses termos REALMENTE significam e onde a indústria esconde armadilhas.',
    content: `Caminhar pelo supermercado virou um campo minado de marketing. Vamos decodificar o rótulo e te dar superpoderes na hora da compra.

**1. A ordem dos ingredientes importa MUITO.**
Os ingredientes são listados em ordem decrescente de quantidade. Se "açúcar" aparece nos três primeiros, é um produto açucarado — independente do que diz a frente da embalagem.

**2. "Zero açúcar" ≠ saudável.**
Pode conter adoçantes artificiais (aspartame, sucralose) ou álcoois de açúcar. E muitas vezes vem com mais gordura para compensar o sabor.

**3. Cuidado com os "açúcares disfarçados".**
A indústria usa dezenas de nomes para açúcar: xarope de glicose, maltodextrina, dextrose, sacarose, frutose, xarope de milho, melado, mel... Se aparecem 3+ tipos diferentes, é truque para o açúcar não ficar nos primeiros lugares da lista.

**4. "Integral" exige atenção.**
Pão "integral" muitas vezes tem só 5-15% de farinha integral, sendo o resto farinha branca + caramelo para dar cor. Procure: "farinha de trigo integral" como **primeiro** ingrediente.

**5. A tabela nutricional: o que olhar primeiro.**
- **Porção:** Sempre verifique. Um biscoito mostra valores "por 30g" (3 unidades), mas você come o pacote.
- **Sódio:** Acima de 400mg por porção = alto. Limite diário: 2000mg.
- **Gorduras trans:** Devem ser ZERO. Mesmo "0g" pode esconder até 0,2g por porção (legalmente arredondado).
- **Fibras:** Quanto mais, melhor. Mínimo: 3g por porção em produtos de cereal.

**6. Os selos da Anvisa (lupa frontal).**
Desde 2022, alimentos com excesso recebem alertas: "ALTO EM AÇÚCAR ADICIONADO", "ALTO EM SÓDIO", "ALTO EM GORDURA SATURADA". **Use isso a seu favor — produtos sem nenhum selo são quase sempre a melhor escolha.**

**7. "Natural", "artesanal", "fit", "saudável" — não significam NADA.**
Não são termos regulamentados. Podem estar em qualquer produto.

**Regra de ouro de Michael Pollan:**
> "Não compre nada que sua bisavó não reconheceria como comida."
Quanto mais curta a lista de ingredientes e mais palavras você reconhece, melhor.${ctaLine}`,
    category: "Nutrição",
    cover_image_url:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    read_time: "8 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 17).toISOString(),
    isMock: true,
  },
  {
    id: "mock-treino-em-jejum",
    slug: "treino-em-jejum-ciencia-vs-mito",
    title: "Treino em Jejum: Ciência vs. Mito",
    excerpt:
      "Treinar em jejum queima mais gordura? Faz perder massa? A literatura científica tem respostas claras — e algumas surpreendentes.",
    content: `O "fasted training" virou tendência, especialmente entre praticantes de jejum intermitente. Mas o que diz a ciência?

**Mito #1: "Treinar em jejum queima MAIS gordura."**
Parcialmente verdade — e parcialmente irrelevante. Sim, durante o exercício em jejum você oxida mais ácidos graxos como combustível. Mas estudos de até 12 semanas (Schoenfeld et al., 2014) mostram que a perda de gordura corporal **TOTAL** é a mesma em jejum ou alimentado, desde que o déficit calórico semanal seja igual.

**O que importa de verdade:** déficit calórico semanal e total de proteína. O resto é detalhe.

**Mito #2: "Você perde massa muscular treinando em jejum."**
Falso para treinos curtos (até 60 minutos) e de intensidade moderada. Para treinos longos (90+ min) ou de altíssima intensidade, há aumento real da degradação proteica — nesses casos, **alimentar-se antes é vantajoso**.

**Mito #3: "Cardio em jejum é melhor pra definição."**
Estudos comparando cardio em jejum vs. alimentado mostram resultado **idêntico** na composição corporal a longo prazo. A "vantagem" do jejum é puramente psicológica/prática, não fisiológica.

**Quando treinar em jejum FAZ sentido:**
- ✅ Treinos leves a moderados (caminhada, corrida leve, yoga, musculação convencional)
- ✅ Quem se sente bem treinando assim e ganha praticidade
- ✅ Adeptos do protocolo 16:8 que treinam de manhã
- ✅ Pessoas com glicemia estável e sem hipoglicemia reativa

**Quando NÃO treinar em jejum:**
- ❌ Treinos de alta intensidade (HIIT, CrossFit, levantamento pesado)
- ❌ Treinos longos (>90 min) ou multi-sessão
- ❌ Atletas de performance (força, potência)
- ❌ Quem sente tontura, fraqueza ou náusea
- ❌ Diabéticos sem orientação médica

**E a "janela anabólica" pós-treino?**
É mais larga do que se pensava. Após treinar em jejum, fazer uma refeição com 25-40g de proteína nas próximas 1-2 horas é mais que suficiente para maximizar a síntese proteica.

**Veredito:** Treinar em jejum não é melhor nem pior — é uma ferramenta. Se funciona pra você e seu treino é compatível, use. Se atrapalha sua performance, coma antes. Sem drama.${ctaLine}`,
    category: "Ciência",
    cover_image_url:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80",
    read_time: "7 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    isMock: true,
  },
  {
    id: "mock-sono-hipertrofia",
    slug: "importancia-do-sono-na-hipertrofia",
    title: "A importância do Sono na hipertrofia e perda de gordura",
    excerpt:
      "Você pode treinar perfeito e comer impecável — mas se dorme mal, está sabotando 50% dos seus resultados. Entenda o porquê.",
    content: `Existe um suplemento legal, gratuito e mais poderoso que qualquer pré-treino: **dormir bem**. E a maioria das pessoas ignora completamente.

**Por que o sono é tão crítico?**

**1. Hormônios anabólicos em pico.**
Cerca de 70% do GH (hormônio do crescimento) é liberado durante o sono profundo. A testosterona também atinge seus picos no início da manhã, após noites bem dormidas. Dormir 5h em vez de 8h pode reduzir a testosterona em até 15% em apenas uma semana (Leproult & Van Cauter, 2011).

**2. Recuperação muscular real.**
A síntese proteica e a reparação tecidual acontecem majoritariamente durante o sono REM e NREM profundo. Sem sono, o músculo não recupera — ele só acumula dano.

**3. Sensibilidade à insulina.**
Privação de sono crônica reduz a sensibilidade à insulina em 30%, dificultando o particionamento de nutrientes (mais gordura, menos músculo).

**4. Controle de fome.**
Quem dorme menos de 6h tem **leptina** (hormônio da saciedade) baixa e **grelina** (hormônio da fome) alta. Resultado: mais fome, mais desejo por carbo refinado e açúcar. Em média, +300 kcal/dia de consumo extra.

**5. Performance no treino.**
Estudos com atletas mostram queda de 10-30% na potência, força e tempo de reação após uma única noite ruim. Treinar mal = estímulo ruim = adaptação ruim.

**Quanto dormir?**
- **Adulto sedentário:** 7-8h
- **Atleta / pessoa em treinamento intenso:** 8-9h
- **Em fase de cutting agressivo:** 9h+ (o estresse calórico aumenta a demanda)

**Como melhorar a qualidade do sono:**

✅ **Horário consistente** — dormir e acordar no mesmo horário, todos os dias.
✅ **Quarto escuro e fresco** — temperatura ideal: 18-20°C.
✅ **Sem telas 1h antes** — luz azul suprime a melatonina.
✅ **Evite cafeína após 14h** — meia-vida da cafeína é de 6-8h.
✅ **Última refeição 2-3h antes** — digestão pesada atrapalha o sono profundo.
✅ **Magnésio (200-400mg)** — pode melhorar a qualidade do sono profundo.
✅ **Exposição ao sol pela manhã** — calibra o ritmo circadiano.

**Ferramentas úteis:**
- Apps de tracking (Sleep Cycle, Whoop, Oura Ring) ajudam a identificar padrões.
- Bloqueadores de luz azul à noite (modo noturno do celular, óculos amber).

**Veredito:** Treinar 5x por semana e dormir 5 horas é como tentar encher um balde furado. Priorize o sono ANTES de qualquer suplemento, periodização avançada ou dieta da moda. É o ROI mais alto da sua jornada.${ctaLine}`,
    category: "Performance",
    cover_image_url:
      "https://images.unsplash.com/photo-1520206183501-b80df61043c2?auto=format&fit=crop&w=1200&q=80",
    read_time: "8 min",
    featured: false,
    published: true,
    status: "published",
    author_id: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 23).toISOString(),
    isMock: true,
  },
];
