import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

import { execSync } from 'child_process';

export async function connectDB() {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('file:')) {
      console.log('🔄 Synchronizing PostgreSQL schema...');
      try {
        execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
      } catch (pushErr) {
        console.warn('Prisma db push notice:', pushErr);
      }
    }
    await prisma.$connect();
    console.log('✅ Database connected successfully via Prisma');
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
}
