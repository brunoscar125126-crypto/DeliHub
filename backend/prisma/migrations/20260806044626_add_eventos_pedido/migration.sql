-- CreateTable
CREATE TABLE "eventos_pedido" (
    "id" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pedido_pkey" PRIMARY KEY ("id")
);
