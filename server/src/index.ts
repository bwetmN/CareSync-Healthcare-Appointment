import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';
import { errorHandler } from './middleware/error.middleware.js';
import { startBackgroundWorkers } from './jobs/queue.js';

// Route Imports
import authRoutes from './routes/auth.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import doctorPortalRoutes from './routes/doctor-portal.routes.js';
import adminRoutes from './routes/admin.routes.js';
import calendarRoutes from './routes/calendar.routes.js';

const app = express();

// Middlewares
app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CareSync Healthcare API',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctor-portal', doctorPortalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calendar', calendarRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Server
async function bootstrap() {
  await connectDB();

  // Launch background tasks (BullMQ + Cron Worker)
  startBackgroundWorkers();

  app.listen(env.PORT, () => {
    console.log(`
  🏥 ========================================================
  CareSync Healthcare Appointment & Follow-up Manager
  Server listening on: http://localhost:${env.PORT}
  Client App URL:     ${env.CLIENT_URL}
  Environment:        ${env.NODE_ENV}
  Database:           Prisma (PostgreSQL / SQLite ready)
  ========================================================
    `);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});
