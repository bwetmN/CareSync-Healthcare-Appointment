import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('🌱 Checking CareSync database state...');

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('🌱 Database already contains data. Skipping seed to prevent overwriting.');
    return;
  }

  console.log('🌱 Database is empty. Starting CareSync database seed...');

  const commonPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Demo Users
  console.log('👤 Creating Demo Users...');
  const patientUser = await prisma.user.create({
    data: {
      email: 'patient@demo.com',
      passwordHash: commonPassword,
      name: 'Sarah Jenkins',
      role: 'PATIENT',
      phone: '+1 (555) 234-5678',
    },
  });

  const patientUser2 = await prisma.user.create({
    data: {
      email: 'alex.morris@demo.com',
      passwordHash: commonPassword,
      name: 'Alex Morris',
      role: 'PATIENT',
      phone: '+1 (555) 876-5432',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      passwordHash: commonPassword,
      name: 'Elena Rostova (Admin)',
      role: 'ADMIN',
      phone: '+1 (555) 999-0000',
    },
  });

  // 2. Create Doctors
  console.log('🩺 Creating Doctor Profiles...');
  const doctorUser1 = await prisma.user.create({
    data: {
      email: 'doctor@demo.com',
      passwordHash: commonPassword,
      name: 'Gregory House',
      role: 'DOCTOR',
      phone: '+1 (555) 111-2233',
    },
  });

  const doc1 = await prisma.doctorProfile.create({
    data: {
      userId: doctorUser1.id,
      specialization: 'Cardiology & Diagnostic Medicine',
      bio: 'Board-certified diagnostician specializing in complex cardiac anomalies, arrhythmias, and cardiovascular prevention.',
      consultationFee: 75.0,
      slotDurationMinutes: 30,
      workingStartTime: '09:00',
      workingEndTime: '17:00',
      workingDays: '1,2,3,4,5',
    },
  });

  const doctorUser2 = await prisma.user.create({
    data: {
      email: 'lisa.cuddy@demo.com',
      passwordHash: commonPassword,
      name: 'Lisa Cuddy',
      role: 'DOCTOR',
      phone: '+1 (555) 222-3344',
    },
  });

  const doc2 = await prisma.doctorProfile.create({
    data: {
      userId: doctorUser2.id,
      specialization: 'Endocrinology & Internal Medicine',
      bio: 'Leading specialist in diabetes management, thyroid disorders, and metabolic health.',
      consultationFee: 65.0,
      slotDurationMinutes: 30,
      workingStartTime: '09:00',
      workingEndTime: '16:00',
      workingDays: '1,2,3,4,5',
    },
  });

  const doctorUser3 = await prisma.user.create({
    data: {
      email: 'eric.foreman@demo.com',
      passwordHash: commonPassword,
      name: 'Eric Foreman',
      role: 'DOCTOR',
      phone: '+1 (555) 333-4455',
    },
  });

  const doc3 = await prisma.doctorProfile.create({
    data: {
      userId: doctorUser3.id,
      specialization: 'Neurology',
      bio: 'Expert in migraines, neurodegenerative diagnostics, and stroke rehabilitation.',
      consultationFee: 80.0,
      slotDurationMinutes: 45,
      workingStartTime: '10:00',
      workingEndTime: '18:00',
      workingDays: '1,2,3,4,5',
    },
  });

  const doctorUser4 = await prisma.user.create({
    data: {
      email: 'allison.cameron@demo.com',
      passwordHash: commonPassword,
      name: 'Allison Cameron',
      role: 'DOCTOR',
      phone: '+1 (555) 444-5566',
    },
  });

  const doc4 = await prisma.doctorProfile.create({
    data: {
      userId: doctorUser4.id,
      specialization: 'Immunology & Allergy',
      bio: 'Specialist in chronic allergies, autoimmune conditions, and pediatric immunology.',
      consultationFee: 60.0,
      slotDurationMinutes: 30,
      workingStartTime: '09:00',
      workingEndTime: '15:00',
      workingDays: '1,2,3,4',
    },
  });

  // Calculate dynamic dates for realistic calendar view
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const inThreeDays = new Date(today);
  inThreeDays.setDate(today.getDate() + 3);
  const inThreeDaysStr = inThreeDays.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 2);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 3. Create Sample Appointments
  console.log('📅 Creating Sample Appointments with AI Triage...');

  // Tomorrow appointment for Sarah Jenkins with Dr. House
  const appt1 = await prisma.appointment.create({
    data: {
      patientId: patientUser.id,
      doctorId: doc1.id,
      appointmentDate: tomorrowStr,
      startTime: '10:00',
      endTime: '10:30',
      status: 'BOOKED',
      symptoms: 'Experiencing intermittent sharp chest tightness and shortness of breath when walking uphill for past 4 days.',
      preVisitUrgency: 'High',
      preVisitSummary: 'Intermittent sharp chest tightness and exertional dyspnea.',
      preVisitQuestions: JSON.stringify([
        'Does the chest tightness radiate down your left arm or up into your jaw?',
        'Do you feel lightheaded, nauseous, or break into cold sweats during these episodes?',
        'Have you taken any nitrates or aspirin, and did it provide relief?',
      ]),
      googleCalendarEventId: 'mock_cal_seed_001',
    },
  });

  // Today appointment for Alex Morris with Dr. House
  await prisma.appointment.create({
    data: {
      patientId: patientUser2.id,
      doctorId: doc1.id,
      appointmentDate: todayStr,
      startTime: '14:00',
      endTime: '14:30',
      status: 'BOOKED',
      symptoms: 'Mild joint soreness in wrists and morning stiffness lasting 20 minutes.',
      preVisitUrgency: 'Low',
      preVisitSummary: 'Mild wrist joint stiffness and morning discomfort.',
      preVisitQuestions: JSON.stringify([
        'How long have you noticed the stiffness in your joints each morning?',
        'Is there visible swelling, warmth, or redness around the wrist joints?',
        'Do repetitive movements like typing make the discomfort worse?',
      ]),
      googleCalendarEventId: 'mock_cal_seed_002',
    },
  });

  // Past completed appointment for Sarah Jenkins with Dr. Cuddy (with clinical notes & prescriptions)
  const pastAppt = await prisma.appointment.create({
    data: {
      patientId: patientUser.id,
      doctorId: doc2.id,
      appointmentDate: yesterdayStr,
      startTime: '11:00',
      endTime: '11:30',
      status: 'COMPLETED',
      symptoms: 'Fatigue, increased thirst, and mild weight fluctuations.',
      preVisitUrgency: 'Medium',
      preVisitSummary: 'Fatigue, polydipsia, and weight fluctuation.',
      preVisitQuestions: JSON.stringify([
        'What was your last fasting blood glucose reading if tested?',
        'Have you noticed any changes in appetite or sleep patterns?',
        'Is there a history of endocrine disorders in your immediate family?',
      ]),
      postVisitNotes: 'Patient presented with mild hyperglycemia and metabolic fatigue. HbA1c 6.8%. Initiated Metformin 500mg daily. Dietary lifestyle modifications advised.',
      postVisitSummary: JSON.stringify({
        patientSummary: 'Dr. Cuddy evaluated your lab results which indicate early-stage blood sugar elevation (HbA1c 6.8%). We are starting you on a gentle medication to support your body while you make positive dietary adjustments.',
        medicationSchedule: [
          {
            medication: 'Metformin Hydrochloride',
            dosage: '500mg tablet',
            frequency: 'Once daily with evening meal',
            instructions: 'Take with a full glass of water during dinner to avoid stomach upset.',
            duration: '30 days',
          },
        ],
        followUpSteps: [
          'Maintain a low glycemic index diet and walk for 30 minutes daily.',
          'Log your morning fasting blood sugar twice weekly.',
          'Schedule a follow-up review in 4 weeks for repeat blood panel.',
        ],
        precautions: [
          'Avoid skipping meals while on medication.',
          'Contact clinic if you experience persistent nausea or dizziness.',
        ],
      }),
      googleCalendarEventId: 'mock_cal_seed_003',
    },
  });

  // 4. Create Active Prescriptions
  console.log('💊 Creating Active Prescriptions...');
  await prisma.prescription.create({
    data: {
      appointmentId: pastAppt.id,
      patientId: patientUser.id,
      doctorId: doc2.id,
      medicationName: 'Metformin Hydrochloride',
      dosage: '500mg',
      frequency: 'ONCE_DAILY',
      durationDays: 30,
      instructions: 'Take 1 tablet with evening meal',
      startDate: yesterdayStr,
    },
  });

  // 5. Seed a Doctor Leave for Dr. Foreman in 3 days for conflict testing
  console.log('🏖️ Seeding Sample Doctor Leave...');
  await prisma.doctorLeave.create({
    data: {
      doctorId: doc3.id,
      leaveDate: inThreeDaysStr,
      reason: 'Attending Annual Neurology Symposium',
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('----------------------------------------------------');
  console.log('📋 Demo Accounts Ready for Instant Evaluation:');
  console.log('  👤 Patient: patient@demo.com  / Password123!');
  console.log('  🩺 Doctor:  doctor@demo.com   / Password123!');
  console.log('  🛡️ Admin:   admin@demo.com    / Password123!');
  console.log('----------------------------------------------------');
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDatabase()
    .catch((e) => {
      console.error('❌ Seed error:', e);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
