import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully via Prisma');
  } catch (error) {
    console.error('❌ Failed to connect to Database:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
}
