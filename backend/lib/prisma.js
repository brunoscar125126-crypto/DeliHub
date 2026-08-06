const { PrismaClient } = require('@prisma/client');

// Evita instanciar múltiplos PrismaClient em hot-reload (nodemon) durante o dev.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
