import { prisma } from '../config/database.js';
import { bookAppointment } from '../services/booking.service.js';

async function runConcurrencyTest() {
  console.log('\n🧪 ========================================================');
  console.log('⚡ RUNNING CONCURRENCY & DOUBLE-BOOKING PROTECTION TEST');
  console.log('========================================================');

  // Find a test doctor and test patient
  const doctor = await prisma.doctorProfile.findFirst({
    include: { user: true },
  });
  const patient = await prisma.user.findFirst({
    where: { role: 'PATIENT' },
  });

  if (!doctor || !patient) {
    throw new Error('Doctor or Patient not found in DB. Run seed first.');
  }

  // Choose an isolated test slot date in future
  const testDate = '2026-09-15';
  const testStartTime = '10:00';
  const testEndTime = '10:30';

  // Clean up any preexisting appointments on this test slot
  await prisma.appointment.deleteMany({
    where: {
      doctorId: doctor.id,
      appointmentDate: testDate,
      startTime: testStartTime,
    },
  });

  const CONCURRENT_REQUESTS = 20;
  console.log(`💥 Blasting ${CONCURRENT_REQUESTS} parallel booking requests at the same millisecond...`);
  console.log(`🎯 Doctor: Dr. ${doctor.user.name} | Slot: ${testDate} at ${testStartTime}`);

  const bookingPromises = Array.from({ length: CONCURRENT_REQUESTS }).map((_, index) =>
    bookAppointment({
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentDate: testDate,
      startTime: testStartTime,
      endTime: testEndTime,
      symptoms: `Concurrent test patient #${index + 1} with severe headache and fever`,
    })
      .then((res) => ({ status: 'SUCCESS', id: res.id, index }))
      .catch((err) => ({ status: 'FAILED', code: err.code, message: err.message, index }))
  );

  const results = await Promise.all(bookingPromises);

  const successfulBookings = results.filter((r) => r.status === 'SUCCESS');
  const failedBookings = results.filter((r) => r.status === 'FAILED');

  console.log('\n📊 Concurrency Results:');
  console.log(`  ✅ Successful Bookings: ${successfulBookings.length}`);
  console.log(`  🛑 Conflicted (Prevented): ${failedBookings.length}`);

  // Query database to verify actual row count
  const dbCount = await prisma.appointment.count({
    where: {
      doctorId: doctor.id,
      appointmentDate: testDate,
      startTime: testStartTime,
      status: 'BOOKED',
    },
  });

  console.log(`  🔍 Database Verified Active Bookings in Slot: ${dbCount}`);

  if (successfulBookings.length === 1 && failedBookings.length === CONCURRENT_REQUESTS - 1 && dbCount === 1) {
    console.log('\n🎉 PASS: Double-Booking Prevention is 100% ACID Compliant & Race-Condition Safe!\n');
  } else {
    console.error('\n❌ FAIL: Race condition occurred! Double booking was not prevented.');
    process.exit(1);
  }

  // Cleanup test record
  await prisma.appointment.deleteMany({
    where: {
      doctorId: doctor.id,
      appointmentDate: testDate,
      startTime: testStartTime,
    },
  });

  await prisma.$disconnect();
}

runConcurrencyTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
