# DeliHub

Sistema de gestão centralizada de delivery — unifica pedidos, cardápio e
preços de múltiplas plataformas (iFood, 99Food, Rappi, Keeta) em um único
painel. Ver [`DeliHub-resumo-tecnico.md`](./DeliHub-resumo-tecnico.md) para o
desenho completo da arquitetura.

## Estrutura

```
/backend
  /connectors      → um módulo por plataforma (ifood.js, noventaenove.js, keeta.js)
  /routes
    produtos.js     → listar/criar produto, pausar/despausar (fan-out por plataforma)
    importacao.js   → prévia + confirmação de importação de cardápio
  /lib
    prisma.js       → instância única do PrismaClient
    tokenManager.js → getValidToken(plataforma), com renovação automática de token
    importacao.js   → busca + normaliza cardápio por plataforma pro formato interno
    asyncHandler.js → wrapper de erro assíncrono pras rotas
  /prisma
    schema.prisma   → PlatformToken, Produto, ProdutoPlataforma
  server.js
/frontend            → React + Tailwind
  src/
    Dashboard.jsx     → lista produtos, pausar/despausar
    Importacao.jsx    → importação de cardápio (prévia + criar/mesclar produto)
    ProdutoCard.jsx
    lib/api.js         → único ponto de contato com o backend
```

## Setup do backend

```bash
cd backend
npm install
cp .env.example .env
```

Preencha o `.env` com as credenciais reais (iFood: app de teste
"Centralizado"; 99Food: `app_id`/`app_secret`/`app_shop_id`) e a
`DATABASE_URL` de um Postgres local ou do Railway.

```bash
npx prisma migrate dev --name init
npm run dev
```

O servidor sobe em `http://localhost:3000` (`GET /health` para checar).

## Roadmap (próximas etapas)

1. ~~Setup do projeto~~ ✅
2. ~~`tokenManager.js`~~ ✅
3. ~~Conector 99Food~~ ✅ (autenticação, listar, atualizar item, pausar — testado contra a API real)
4. ~~Conector iFood~~ ✅ (autenticação, listar lojas/catálogos, criar categoria/item, pausar — auth e listagem testados contra a API real)
5. ~~Modelo de dados no Prisma~~ ✅ (`Produto` + `ProdutoPlataforma`, mapeamento de ID/preço/status por plataforma)
6. ~~Rotas do backend~~ ✅ (`produtos.js`: listar/criar/pausar/despausar, fan-out por plataforma testado contra as APIs reais)
7. ~~Dashboard React~~ ✅ (lista produtos, pausar/despausar, mostra falhas de sincronização por plataforma)
8. ~~Importação inicial de cardápio~~ ✅ (prévia por plataforma, sugestão de match por nome entre plataformas, criar produto novo ou mesclar — testado contra 99Food e iFood reais)

## Observações importantes descobertas na prática

- **99Food exige `refresh` → `get`** nessa ordem pra gerar um token quando
  não existe um válido — chamar só `get` falha com `errno 10102`. Já
  corrigido em `tokenManager.js`.
- **99Food rate limit**: `item/item/list` aceita só 2 chamadas a cada 120s
  (`errno 10005` se estourar). `Importacao.jsx` só busca sob clique
  explícito, nunca em loop/auto-refresh.
- **iFood tem delay de indexação**: um item recém-criado pode não aparecer
  em `categories?include_items=true` por um tempo — usar `buscarItemPorId`
  pra confirmar a criação, se necessário.
