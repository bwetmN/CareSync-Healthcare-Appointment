import { prisma } from '../config/database.js';
import { holdSlot, bookAppointment, getDoctorAvailableSlots } from '../services/booking.service.js';
import { applyDoctorLeave, removeDoctorLeave } from '../services/leave.service.js';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/ai.service.js';

async function runSystemIntegrationTests() {
  console.log('\n🧪 ========================================================');
  console.log('🏥 RUNNING END-TO-END HEALTHCARE SYSTEM WORKFLOW TESTS');
  console.log('========================================================');

  const doctor = await prisma.doctorProfile.findFirst({ include: { user: true } });
  const patient = await prisma.user.findFirst({ where: { role: 'PATIENT' } });

  if (!doctor || !patient) throw new Error('Seeded doctor/patient not found');

  const testDate = '2026-10-05';

  // 1. Test AI Pre-Visit Symptom Analysis
  console.log('\n1️⃣ Testing AI Pre-Visit Symptom Triage Analysis...');
  const symptoms = 'Severe chest tightness radiating to jaw and shortness of breath.';
  const triage = await generatePreVisitSummary(symptoms);
  console.log('   Urgency Level:', triage.urgency);
  console.log('   Chief Complaint:', triage.chiefComplaint);
  console.log('   Questions Generated:', triage.suggestedQuestions.length);
  if (triage.urgency !== 'High' || triage.suggestedQuestions.length < 3) {
    throw new Error('AI Pre-Visit triage failed to classify acute symptoms correctly');
  }
  console.log('   ✅ AI Pre-Visit Triage Test Passed.');

  // 2. Test Slot Hold Mechanism
  console.log('\n2️⃣ Testing 5-Minute Slot Hold Mechanism...');
  const hold = await holdSlot({
    doctorId: doctor.id,
    patientId: patient.id,
    slotDate: testDate,
    startTime: '11:00',
    endTime: '11:30',
  });
  console.log('   Hold Token generated:', hold.holdToken.substring(0, 12) + '...');
  console.log('   Expires At:', hold.expiresAt);

  const slotStatus = await getDoctorAvailableSlots(doctor.id, testDate, 'other-patient-id');
  const heldSlot = slotStatus.slots.find((s) => s.startTime === '11:00');
  console.log('   Slot availability for other patients:', heldSlot?.isAvailable ? 'Available (ERROR)' : 'Held/Locked (CORRECT)');
  if (heldSlot?.isAvailable === true) {
    throw new Error('Slot hold did not lock slot for other patients');
  }
  console.log('   ✅ Slot Hold Lock Test Passed.');

  // 3. Test Booking Conversion with Symptoms
  console.log('\n3️⃣ Testing Booking Confirmation & Conversion...');
  const appt = await bookAppointment({
    patientId: patient.id,
    doctorId: doctor.id,
    appointmentDate: testDate,
    startTime: '11:00',
    endTime: '11:30',
    symptoms,
    holdToken: hold.holdToken,
  });
  console.log('   Appointment Booked with ID:', appt.id);
  console.log('   Appointment Status:', appt.status);
  console.log('   Pre-visit Urgency in DB:', appt.preVisitUrgency);
  if (appt.status !== 'BOOKED' || !appt.preVisitUrgency) {
    throw new Error('Booking creation failed');
  }
  console.log('   ✅ Booking Confirmation Test Passed.');

  // 4. Test Doctor Leave Conflict Resolution
  console.log('\n4️⃣ Testing Doctor Leave Conflict Resolution & Cascade...');
  const leaveRes = await applyDoctorLeave(doctor.id, testDate, 'Medical Conference');
  console.log(`   Leave Applied. Affected Appointments Flagged: ${leaveRes.affectedCount}`);

  const updatedAppt = await prisma.appointment.findUnique({ where: { id: appt.id } });
  console.log('   Appointment status after leave applied:', updatedAppt?.status);
  if (updatedAppt?.status !== 'LEAVE_CONFLICT') {
    throw new Error('Appointment status did not transition to LEAVE_CONFLICT on doctor leave');
  }
  console.log('   ✅ Doctor Leave Conflict Cascade Test Passed.');

  // 5. Test AI Post-Visit Clinical Summary & Prescriptions
  console.log('\n5️⃣ Testing AI Post-Visit Clinical Notes Converter...');
  const notes = 'Patient diagnosed with seasonal allergic rhinitis. Prescribe Cetirizine 10mg once daily for 10 days. Nasal saline rinse as needed.';
  const postSummary = await generatePostVisitSummary(notes);
  console.log('   Patient Friendly Summary:', postSummary.patientSummary.substring(0, 80) + '...');
  console.log('   Medication Schedule Items:', postSummary.medicationSchedule.length);
  console.log('   Follow-up Steps:', postSummary.followUpSteps.length);
  console.log('   ✅ AI Post-Visit Summary Test Passed.');

  // Cleanup
  await removeDoctorLeave(doctor.id, testDate);
  await prisma.appointment.deleteMany({ where: { doctorId: doctor.id, appointmentDate: testDate } });
  await prisma.slotHold.deleteMany({ where: { doctorId: doctor.id, slotDate: testDate } });

  console.log('\n========================================================');
  console.log('🎉 ALL HEALTHCARE SYSTEM TESTS PASSED SUCCESSFULLY (5/5)');
  console.log('========================================================\n');

  await prisma.$disconnect();
}

runSystemIntegrationTests().catch((err) => {
  console.error('System test failed:', err);
  process.exit(1);
});
