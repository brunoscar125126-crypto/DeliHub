-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "statusEvento" TEXT,
ALTER COLUMN "status" DROP NOT NULL;
