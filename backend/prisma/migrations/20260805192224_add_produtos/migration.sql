-- CreateEnum
CREATE TYPE "StatusProduto" AS ENUM ('ATIVO', 'PAUSADO');

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoCentavos" INTEGER NOT NULL,
    "externalCode" TEXT,
    "status" "StatusProduto" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_plataformas" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "precoCentavos" INTEGER,
    "status" "StatusProduto" NOT NULL DEFAULT 'ATIVO',
    "sincronizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produto_plataformas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produtos_externalCode_key" ON "produtos"("externalCode");

-- CreateIndex
CREATE UNIQUE INDEX "produto_plataformas_produtoId_plataforma_key" ON "produto_plataformas"("produtoId", "plataforma");

-- CreateIndex
CREATE UNIQUE INDEX "produto_plataformas_plataforma_itemId_key" ON "produto_plataformas"("plataforma", "itemId");

-- AddForeignKey
ALTER TABLE "produto_plataformas" ADD CONSTRAINT "produto_plataformas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
