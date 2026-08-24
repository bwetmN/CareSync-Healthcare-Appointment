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
    origin: true,
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

import { seedDatabase } from './db/seed.js';

// Start Server
async function bootstrap() {
  const host = '0.0.0.0';
  const port = env.PORT || 5000;
  
  app.listen(port, host, () => {
    console.log(`CareSync server primary listener active on http://${host}:${port}`);
  });

  if (port !== 5000) {
    try {
      app.listen(5000, host, () => {
        console.log(`CareSync server fallback listener active on http://${host}:5000`);
      });
    } catch (e) {
      // Port already in use or restricted
    }
  }

  try {
    await connectDB();
    await seedDatabase();
    startBackgroundWorkers();
  } catch (err) {
    console.error('⚠️ Background initialization warning:', err);
  }
}

bootstrap();

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
