import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { PreVisitAIAnalysis, PostVisitAIAnalysis, UrgencyLevel } from '../types/index.js';

let genAI: GoogleGenerativeAI | null = null;
if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '') {
  genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

/**
 * Fallback heuristic analyzer for Pre-Visit Symptoms
 * Used when Gemini API key is missing or when network/rate-limit occurs.
 */
function fallbackPreVisitAnalysis(symptoms: string): PreVisitAIAnalysis {
  const lower = symptoms.toLowerCase();

  let urgency: UrgencyLevel = 'Low';
  if (
    lower.includes('chest pain') ||
    lower.includes('difficulty breathing') ||
    lower.includes('shortness of breath') ||
    lower.includes('severe bleeding') ||
    lower.includes('unconscious') ||
    lower.includes('stroke') ||
    lower.includes('seizure') ||
    lower.includes('high fever') ||
    lower.includes('vision loss')
  ) {
    urgency = 'High';
  } else if (
    lower.includes('fever') ||
    lower.includes('severe') ||
    lower.includes('vomiting') ||
    lower.includes('dizziness') ||
    lower.includes('infection') ||
    lower.includes('swelling') ||
    lower.includes('pain')
  ) {
    urgency = 'Medium';
  }

  // Extract first meaningful sentence as chief complaint
  const sentences = symptoms.split(/[.!?\n]+/).filter((s) => s.trim().length > 0);
  const chiefComplaint = sentences.length > 0 ? sentences[0].trim() : symptoms.trim();

  // Generate 3 contextual diagnostic questions
  const suggestedQuestions: string[] = [
    'How long have you been experiencing these primary symptoms?',
    'Are the symptoms continuous or do they fluctuate at specific times of day?',
    'Are you currently taking any over-the-counter or prescription medications for relief?',
  ];

  if (urgency === 'High') {
    suggestedQuestions[0] = 'Did the onset of these severe symptoms happen suddenly or gradually?';
    suggestedQuestions[1] = 'Do you have a personal or family history of related cardiovascular or acute conditions?';
  }

  return {
    urgency,
    chiefComplaint: chiefComplaint.length > 120 ? chiefComplaint.substring(0, 117) + '...' : chiefComplaint,
    suggestedQuestions,
    triageAdvice:
      urgency === 'High'
        ? 'High clinical attention recommended. If symptoms rapidly escalate before your appointment, proceed to the nearest emergency facility.'
        : 'Consultation prepared. Please arrive 10 minutes prior to your scheduled slot.',
  };
}

/**
 * Fallback heuristic converter for Post-Visit Notes
 */
function fallbackPostVisitAnalysis(notes: string): PostVisitAIAnalysis {
  const cleanNotes = notes.trim();

  // Look for potential medication mentions
  const lines = cleanNotes.split('\n').map((l) => l.trim()).filter(Boolean);

  return {
    patientSummary: `Thank you for your visit today. Your doctor has evaluated your condition and prescribed appropriate care steps. Clinical notes: ${cleanNotes}`,
    medicationSchedule: [
      {
        medication: 'Prescribed medication',
        dosage: 'As indicated on prescription',
        frequency: 'Daily with water',
        instructions: 'Take after meals. Do not skip scheduled doses.',
        duration: 'As specified by physician',
      },
    ],
    followUpSteps: [
      'Adhere strictly to the prescribed medication and rest plan.',
      'Monitor and log your symptoms daily.',
      'Schedule a follow-up appointment in 7-14 days or if symptoms do not improve.',
    ],
    precautions: [
      'Contact the clinic immediately if you experience adverse reactions or worsening symptoms.',
      'Stay well hydrated and maintain adequate rest.',
    ],
  };
}

/**
 * Analyze symptoms for Doctor Pre-Visit Briefing
 * Prompt specification:
 * "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"
 */
export async function generatePreVisitSummary(symptoms: string): Promise<PreVisitAIAnalysis> {
  if (!symptoms || symptoms.trim().length === 0) {
    return fallbackPreVisitAnalysis('Routine check-up');
  }

  if (!genAI) {
    console.warn('⚠️ Gemini API key not configured. Using deterministic clinical fallback analyzer.');
    return fallbackPreVisitAnalysis(symptoms);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an expert clinical triage AI assistant.
Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}

Return ONLY valid JSON matching this exact schema:
{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": "string summarizing primary patient complaint in 1 sentence",
  "suggestedQuestions": [
    "string question 1",
    "string question 2",
    "string question 3"
  ],
  "triageAdvice": "short guidance sentence"
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText) as PreVisitAIAnalysis;

    // Validate fields
    if (
      (parsed.urgency === 'Low' || parsed.urgency === 'Medium' || parsed.urgency === 'High') &&
      typeof parsed.chiefComplaint === 'string' &&
      Array.isArray(parsed.suggestedQuestions) &&
      parsed.suggestedQuestions.length >= 3
    ) {
      return {
        urgency: parsed.urgency,
        chiefComplaint: parsed.chiefComplaint,
        suggestedQuestions: parsed.suggestedQuestions.slice(0, 3),
        triageAdvice: parsed.triageAdvice || 'Please prepare any previous health records for your consultation.',
      };
    }

    return fallbackPreVisitAnalysis(symptoms);
  } catch (error) {
    console.error('⚠️ LLM Pre-Visit Summary failed gracefully. Falling back to heuristic analyzer:', error);
    return fallbackPreVisitAnalysis(symptoms);
  }
}

/**
 * Convert clinical notes into patient-friendly post-visit summary
 * Prompt specification:
 * "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
 */
export async function generatePostVisitSummary(notes: string): Promise<PostVisitAIAnalysis> {
  if (!notes || notes.trim().length === 0) {
    return fallbackPostVisitAnalysis('Consultation completed successfully.');
  }

  if (!genAI) {
    console.warn('⚠️ Gemini API key not configured. Using deterministic clinical fallback converter.');
    return fallbackPostVisitAnalysis(notes);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a patient-centered clinical communicator AI.
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}

Return ONLY valid JSON matching this exact schema:
{
  "patientSummary": "Clear, empathetic, plain-English explanation of diagnosis and plan (2-4 sentences)",
  "medicationSchedule": [
    {
      "medication": "Name of drug",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Twice daily after breakfast & dinner",
      "instructions": "e.g. Take with water. Do not crush.",
      "duration": "e.g. 5 days"
    }
  ],
  "followUpSteps": [
    "Actionable step 1",
    "Actionable step 2"
  ],
  "precautions": [
    "Safety precaution 1",
    "Warning sign to seek immediate care"
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText) as PostVisitAIAnalysis;

    if (
      typeof parsed.patientSummary === 'string' &&
      Array.isArray(parsed.medicationSchedule) &&
      Array.isArray(parsed.followUpSteps)
    ) {
      return parsed;
    }

    return fallbackPostVisitAnalysis(notes);
  } catch (error) {
    console.error('⚠️ LLM Post-Visit Summary failed gracefully. Falling back to heuristic analyzer:', error);
    return fallbackPostVisitAnalysis(notes);
  }
}
