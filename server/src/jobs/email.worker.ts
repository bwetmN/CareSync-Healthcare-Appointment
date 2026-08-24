import { prisma } from '../config/database.js';
import { dispatchOutboxEmail } from '../services/email.service.js';

export async function processEmailQueue(): Promise<number> {
  const now = new Date();

  // Find pending emails ready for dispatch
  const pendingEmails = await prisma.emailOutbox.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: now },
      attempts: { lt: 5 },
    },
    take: 10,
    orderBy: { nextRetryAt: 'asc' },
  });

  if (pendingEmails.length === 0) {
    return 0;
  }

  let processed = 0;
  for (const email of pendingEmails) {
    const success = await dispatchOutboxEmail(email.id);
    if (success) processed++;
  }

  return processed;
}
