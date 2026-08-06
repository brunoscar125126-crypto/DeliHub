-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "shop" JSONB NOT NULL,
    "price" JSONB NOT NULL,
    "receiveAddress" JSONB NOT NULL,
    "orderItems" JSONB NOT NULL,
    "payloadBruto" JSONB NOT NULL,
    "confirmadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_plataforma_orderId_key" ON "pedidos"("plataforma", "orderId");
