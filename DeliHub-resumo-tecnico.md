# DeliHub — Resumo Técnico do Projeto

## Visão geral

Sistema de gestão centralizada de delivery, unificando pedidos, cardápio e preços de múltiplas plataformas (iFood, 99Food, Rappi, Keeta) em um único painel. Objetivo de longo prazo: vender como micro SaaS para outros lojistas.

**Problemas que o sistema resolve:**
- Taxas diferentes por plataforma exigem preços diferentes por plataforma
- Produto esgotado precisa ser removido manualmente em cada plataforma
- Repasse semanal precisa ser somado manualmente entrando em cada plataforma

**Pensando no futuro SaaS:** o onboarding de um novo lojista não pode ser cadastro manual produto a produto — precisa puxar automaticamente o cardápio já existente na loja dele (via endpoint de listagem de cada plataforma) e fazer um matching/merge assistido entre plataformas.

---

## Stack definido

- **Backend:** Node.js + Express
- **ORM/Banco:** Prisma + PostgreSQL (Postgres gerenciado pelo próprio Railway)
- **Frontend:** React + Tailwind CSS
- **Deploy:** Railway, conectado ao GitHub (deploy automático a cada push)
- **Segurança:** credenciais de cada plataforma (app_id/secret, client_id/secret) ficam em variáveis de ambiente — nunca no código nem no frontend

## Arquitetura de conectores

Um módulo por plataforma, cada um traduzindo o formato daquela API para um formato interno único do sistema. O resto do sistema (dashboard, financeiro, estoque) nunca fala diretamente com nenhuma plataforma — só com os conectores.

```
/backend
  /connectors
    noventaenove.js   → tudo que fala com a API da 99Food
    ifood.js          → tudo que fala com a API do iFood
    keeta.js          → (futuro, quando liberado)
  /routes
    produtos.js        → recebe ações do frontend, chama os conectores certos
  /lib
    tokenManager.js     → getValidToken() por plataforma, com renovação automática
/frontend
  ProdutoCard.jsx
  Dashboard.jsx
```

Fluxo de qualquer ação (ex: pausar produto):
```
Frontend → POST /api/produtos/:id/pausar → Backend
Backend busca no banco o ID do produto em cada plataforma
Backend chama getValidToken() por plataforma (renova se expirado)
Backend dispara a chamada real para cada plataforma em paralelo
Backend atualiza status no próprio banco
Backend responde ao frontend
```

### Gerenciamento de token (essencial, primeira peça a construir)

Os tokens de acesso expiram (99Food: minutos; iFood: ~6h). O backend precisa de uma função central `getValidToken(plataforma)` que:
- Verifica se já existe token salvo e válido (compara com a expiração)
- Se válido, reutiliza
- Se expirado, gera um novo automaticamente e salva (token + nova expiração) em uma tabela tipo `platform_tokens`

Nunca deve haver geração manual de token em produção — é 100% automático.

---

## 99Food — API validada

**Host:** `https://openapi.didi-food.com`

**Credenciais necessárias (variáveis de ambiente):**
- `app_id`
- `app_secret`
- `app_shop_id` (identifica a loja — ex: `delihubb`)

### Autenticação

```
GET /v1/auth/authtoken/get
Query params: app_id, app_secret, app_shop_id
→ retorna: auth_token, token_expiration_time
```

Renovar (gera sempre um token novo):
```
GET /v1/auth/authtoken/refresh
Query params: iguais ao get
```

O `auth_token` retornado é usado como parâmetro em todas as chamadas seguintes (via query string, não header).

### Endpoints principais testados

| Ação | Endpoint | Método |
|---|---|---|
| Listar cardápio | `/v1/item/item/list` | GET (auth_token na query) |
| Subir cardápio | `/v1/item/item/upload` ou `/uploadV2` | POST |
| Atualizar item | `/v1/item/item/update` | POST |
| Atualizar status do item | `/v1/item/item/updateItemStatus` | POST |
| Detalhe do pedido | `/v1/order/order/detail` | GET |
| Confirmar pedido | `/v1/order/order/confirm` | POST |
| Cancelar pedido | `/v1/order/order/cancel` | POST |
| Pedido pronto | `/v1/order/order/ready` | POST |
| Pedido entregue | `/v1/order/order/delivered` | POST |
| Detalhe da loja | `/v1/shop/shop/detail` | GET |
| Status da loja | `/v1/shop/shop/setStatus` | POST |

### Status de disponibilidade do item
- `1` = disponível
- `2` = indisponível/pausado

### Estrutura de dados
Modelo: **menu → categoria → item → sub_item (opções)**. Preços em centavos. IDs (app, pedido, loja) são inteiros 64-bit — cuidado ao parsear em JS (usar `json-bigint`, não `JSON.parse` puro).

### Testes já validados manualmente (via ReqBin)
- ✅ Autenticação (auth_token gerado com sucesso)
- ✅ Listagem de cardápio (`item/item/list`)
- ✅ Atualização de status (`updateItemStatus`, pausou item de teste com sucesso, `data: true`)

### Observação importante
Não há endpoint de repasse/financeiro/settlement documentado na especificação OpenAPI — repasse provavelmente segue manual via painel.

---

## iFood — API validada

**Host:** `https://merchant-api.ifood.com.br`

**Credenciais necessárias (variáveis de ambiente):**
- `clientId`
- `clientSecret`
- Use o **aplicativo de teste Centralizado** (criado automaticamente ao se cadastrar, em "Meus apps") — não o app "DeliHub" oficial, que exige homologação antes de liberar credenciais.

### Autenticação (OAuth 2.0)

```
POST /authentication/v1.0/oauth/token
Content-Type: application/x-www-form-urlencoded
Body: grantType=client_credentials&clientId=...&clientSecret=...
→ retorna: accessToken, type ("bearer"), expiresIn (segundos, ~6h)
```

Uso nas chamadas seguintes:
```
Header: Authorization: Bearer {accessToken}
```

### Endpoints principais testados

| Ação | Endpoint | Método |
|---|---|---|
| Listar lojas (merchants) | `/merchant/v1.0/merchants` | GET |
| Listar catálogos da loja | `/catalog/v2.0/merchants/{merchantId}/catalogs` | GET |
| Listar categorias (+ itens) | `/catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories?include_items=true` | GET |
| Criar categoria | `/catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories` | POST |
| Criar/atualizar item completo | `/catalog/v2.0/merchants/{merchantId}/items` | PUT |
| Buscar item por ID | `/catalog/v2.0/merchants/{merchantId}/items/{itemId}` | GET |
| Atualizar status do item | `/catalog/v2.0/merchants/{merchantId}/items/{itemId}/status` | PATCH |

### Status de disponibilidade do item
- `"AVAILABLE"` = disponível
- `"UNAVAILABLE"` = indisponível/pausado

### Estrutura de dados
Modelo: **catálogo → categoria → item → produto**. Item e produto são entidades separadas com IDs próprios (UUID). Ao criar um item via PUT, é obrigatório gerar UUIDs manualmente para `item.productId` e `products[0].id` (mesmo UUID nos dois, linkando as entidades). `externalCode` é o "código PDV" — recomendado usar como referência única do seu produto (ótimo para o mapeamento entre plataformas). Preços em centavos.

Categoria de pizza é um template especial (`template: "PIZZA"`) com grupos de complementos obrigatórios (tamanho, massa, borda, sabor).

### Observação sobre listagem por categoria
Após criar um item, ele pode não aparecer imediatamente na listagem `categories?include_items=true` (indexação/cache com delay). O item existe de fato — confirme direto via `GET /items/{itemId}`.

### Testes já validados manualmente (via ReqBin)
- ✅ Autenticação (accessToken gerado, escopos: item, order, catalog, merchant, events, financial, etc.)
- ✅ Listagem de lojas (merchants)
- ✅ Listagem de catálogo (retornou catálogo vazio — esperado, ambiente de teste sem produtos)
- ✅ Criação de categoria
- ✅ Criação de item completo (produto "Brigadeiro Gourmet" de teste)
- ✅ Atualização de status (pausou o item, confirmado via GET direto)

### Processo de homologação (só necessário para produção)
- App de teste (Centralizado) já vem liberado, sem necessidade de homologação — é o que foi usado nos testes acima
- Homologação só é exigida para o app de produção, feita **depois** de finalizar desenvolvimento e testes
- Só aceita conta Profissional (CNPJ) — conta Pessoal/Estudante (CPF) não é aceita
- Processo: abrir ticket → agendamento com analista → sessão de ~45 min de validação ao vivo
- Se reprovado, é preciso aguardar 15 dias para nova tentativa

---

## Keeta — ainda não integrado

Processo mais formal, sem sandbox self-service:
1. Cadastro de desenvolvedor (resposta em até 5 dias úteis)
2. Assinatura de NDA
3. Só depois disso são liberadas conta de desenvolvedor e loja de teste
4. Desenvolvimento seguindo docs de Basic/Order/Store/Menu API
5. SIT (testes próprios + revisão formal com a Keeta)
6. Registro de marca
7. UAT obrigatório em produção antes do lançamento

**Decisão:** não bloquear o desenvolvimento por isso. Construir o sistema agora com iFood + 99Food (arquitetura já modular via conectores) e plugar a Keeta depois, sem retrabalho, assim que o acesso for liberado.

---

## Rappi — ainda não investigado

Acesso à API costuma exigir cadastro como parceiro tech, sem processo self-service claro. A ser explorado quando fizer sentido no roadmap.

---

## Ordem sugerida de implementação no Claude Code

1. Setup do projeto (Node.js + Express + Prisma + PostgreSQL, deploy no Railway)
2. `tokenManager.js` — gerenciamento automático de token por plataforma
3. Conector 99Food (autenticação, listar, criar/atualizar item, pausar)
4. Conector iFood (autenticação, listar, criar categoria/item, pausar)
5. Modelo de dados no Prisma: produtos com mapeamento de IDs por plataforma (`ifood_item_id`, `noventaenove_item_id`, etc.)
6. Rotas do backend conectando frontend → conectores
7. Dashboard React básico (listar produtos, pausar/despausar)
8. Módulo de importação inicial de cardápio (puxar produtos já existentes via `list`/`categories`, pensando no onboarding do futuro SaaS)
