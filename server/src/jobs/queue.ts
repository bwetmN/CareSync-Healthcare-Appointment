import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import cron from 'node-cron';
import { processEmailQueue } from './email.worker.js';
import { processMedicationReminders } from './medication.worker.js';
import { process24HourAppointmentReminders, cleanupExpiredSlotHolds } from './reminder.worker.js';

let redisConnection: IORedis | null = null;
let isRedisAvailable = false;

try {
  const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 1000, 3000);
    },
  };

  if (env.REDIS_URL) {
    redisConnection = new (IORedis as any)(env.REDIS_URL, redisOptions);
  } else {
    redisConnection = new (IORedis as any)({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      ...redisOptions,
    });
  }

  redisConnection.on('connect', () => {
    isRedisAvailable = true;
    console.log('✅ Connected to Redis successfully. BullMQ queue worker enabled.');
  });

  redisConnection.on('error', () => {
    isRedisAvailable = false;
  });
} catch (e) {
  isRedisAvailable = false;
}

export let emailBullQueue: Queue | null = null;
export let medicationBullQueue: Queue | null = null;

if (redisConnection && isRedisAvailable) {
  try {
    emailBullQueue = new Queue('email-queue', { connection: redisConnection });
    medicationBullQueue = new Queue('medication-queue', { connection: redisConnection });

    new Worker('email-queue', async (job) => {
      await processEmailQueue();
    }, { connection: redisConnection });

    new Worker('medication-queue', async (job) => {
      await processMedicationReminders();
    }, { connection: redisConnection });
  } catch (e) {
    console.warn('⚠️ BullMQ worker init skipped, using resilient cron worker.');
  }
}

/**
 * Start background workers (runs BullMQ schedulers + node-cron fallback heartbeat)
 */
export function startBackgroundWorkers() {
  console.log('🚀 Starting Background Task Scheduler...');

  // 1. Email Outbox & Retry Worker - runs every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await processEmailQueue();
    } catch (err) {
      console.error('Error in Email Queue Worker:', err);
    }
  });

  // 2. Medication Reminders Worker - runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processMedicationReminders();
    } catch (err) {
      console.error('Error in Medication Reminder Worker:', err);
    }
  });

  // 3. 24-Hour Appointment Reminders - runs every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      await process24HourAppointmentReminders();
    } catch (err) {
      console.error('Error in 24h Reminder Worker:', err);
    }
  });

  // 4. Stale Slot Hold Cleanup - runs every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      await cleanupExpiredSlotHolds();
    } catch (err) {
      console.error('Error in Slot Hold Cleanup Worker:', err);
    }
  });

  console.log('✅ Background workers initialized (Email Retries, Medication Reminders, 24h Alerts, Slot Hold Cleanup)');
}
