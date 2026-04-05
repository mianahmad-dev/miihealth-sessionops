import { v4 as uuidv4 } from "uuid";
import type { TranscriptEvent, SessionResult, VoiceProvider } from "./types";

interface ConversationScript {
  name: string;
  keywords: string[];
  turns: Array<{ user: string; assistant: string }>;
  summary: Record<string, unknown>;
}

const SCRIPTS: ConversationScript[] = [
  {
    name: "chest_pain_intake",
    keywords: ["chest", "cardiac", "heart", "pain"],
    turns: [
      {
        user: "Hi, I've been having some chest pains for the past two days.",
        assistant:
          "Thank you for reaching out. I'm sorry to hear you're experiencing chest pain — that's important to address. Can you tell me your full name and date of birth?",
      },
      {
        user: "Sure, my name is James Hartley, born March 14th, 1978.",
        assistant:
          "Thank you, James. Can you describe the chest pain? Is it sharp, dull, or pressure-like? And does it radiate anywhere, like your arm or jaw?",
      },
      {
        user: "It's more of a pressure feeling, kind of radiates to my left arm.",
        assistant:
          "Understood. That's important information. Are you currently experiencing any shortness of breath, nausea, or sweating along with this pain?",
      },
      {
        user: "A little bit of shortness of breath but no nausea.",
        assistant:
          "James, given your symptoms I'm flagging this for urgent clinical review. Do you have any known heart conditions or are you on any medications currently?",
      },
      {
        user: "I was diagnosed with high blood pressure two years ago. I take lisinopril.",
        assistant:
          "Thank you. Do you have your insurance ID handy, and do you have any known drug allergies?",
      },
      {
        user: "I don't have my insurance card with me right now. No known allergies.",
        assistant:
          "That's okay, we can collect that later. I've noted everything down and flagged this session for immediate clinical follow-up. Please seek emergency care if your symptoms worsen. Is there anything else you'd like to add?",
      },
      {
        user: "No, that's everything.",
        assistant:
          "Thank you, James. A clinician will be in touch with you shortly. Please don't hesitate to call 911 if you experience worsening symptoms. Take care.",
      },
    ],
    summary: {
      chief_concern: "Chest pain with left arm radiation, ongoing for 2 days",
      collected_fields: {
        name: "James Hartley",
        dob: "1978-03-14",
        symptoms: "Pressure-like chest pain radiating to left arm, mild shortness of breath",
        medications: "Lisinopril (for hypertension)",
        allergies: "None known",
      },
      missing_fields: ["insurance_id"],
      escalation_flags: [
        {
          flag: "Patient mentioned chest pain radiating to left arm",
          evidence: "Turn 3: 'It's more of a pressure feeling, kind of radiates to my left arm.'",
          severity: "high",
        },
        {
          flag: "Known hypertension with cardiac symptoms",
          evidence: "Turn 5: 'I was diagnosed with high blood pressure two years ago.'",
          severity: "high",
        },
      ],
      session_quality: "needs_review",
      draft_notes:
        "DRAFT — For staff review only. Patient intake partially complete. Two high-severity escalation flags raised for cardiac symptoms. Recommend immediate clinical follow-up. Insurance ID not collected.",
    },
  },
  {
    name: "general_intake",
    keywords: ["general", "intake", "appointment", "checkup"],
    turns: [
      {
        user: "Hello, I'd like to schedule a general checkup.",
        assistant:
          "Hello! I'd be happy to help you with that. Can I start by getting your full name and date of birth?",
      },
      {
        user: "I'm Maria Gonzalez, born July 22nd, 1990.",
        assistant:
          "Thank you, Maria. What's the primary reason for your visit today — is there anything specific you'd like the doctor to look at?",
      },
      {
        user: "I've been feeling tired lately and my sleep hasn't been great.",
        assistant:
          "I understand. How long have you been experiencing fatigue and sleep issues? And on a scale of 1 to 10, how would you rate the impact on your daily life?",
      },
      {
        user: "About three weeks now. I'd say a 6 out of 10.",
        assistant:
          "Thank you. Are you currently taking any medications or supplements? And do you have any known allergies?",
      },
      {
        user: "Just a daily vitamin D supplement. No known allergies.",
        assistant:
          "Got it. Could you share your insurance ID so I can verify your coverage before scheduling?",
      },
      {
        user: "Yes, my insurance ID is HMO-7734-MG.",
        assistant:
          "Perfect, thank you Maria. I have all the information I need. I'll prepare your intake summary for the doctor. Is there anything else you'd like to mention before your appointment?",
      },
      {
        user: "No, I think that covers it.",
        assistant:
          "Wonderful. You're all set. Your intake has been recorded and will be reviewed by your care team. We'll send confirmation details to your phone. Take care!",
      },
    ],
    summary: {
      chief_concern: "Fatigue and sleep disturbance for approximately 3 weeks",
      collected_fields: {
        name: "Maria Gonzalez",
        dob: "1990-07-22",
        symptoms: "Fatigue, poor sleep quality (3 weeks duration, severity 6/10)",
        medications: "Vitamin D supplement",
        allergies: "None known",
        insurance_id: "HMO-7734-MG",
      },
      missing_fields: [],
      escalation_flags: [],
      session_quality: "completed",
      draft_notes:
        "DRAFT — For staff review only. Intake complete. All required fields collected. No escalation flags. Patient ready for general practitioner consultation.",
    },
  },
  {
    name: "pediatric_intake",
    keywords: ["pediatric", "child", "kid", "baby", "infant", "fever"],
    turns: [
      {
        user: "Hi, I'm calling about my 4-year-old son. He's had a high fever since last night.",
        assistant:
          "Thank you for calling. I understand this must be worrying. Can you tell me the child's full name and date of birth?",
      },
      {
        user: "His name is Oliver Chen, born September 3rd, 2021.",
        assistant:
          "Thank you. What is Oliver's current temperature, and how long has the fever been present?",
      },
      {
        user: "It's been about 14 hours. His temperature is 103.2 degrees Fahrenheit.",
        assistant:
          "A fever of 103.2°F in a 4-year-old does require prompt attention. Has he shown any other symptoms — rash, difficulty breathing, lethargy, or refusal to eat?",
      },
      {
        user: "He's been very lethargic and hasn't eaten much. No rash that I can see.",
        assistant:
          "Understood. Has Oliver had any recent illnesses, vaccinations, or exposure to sick contacts in the past week?",
      },
      {
        user: "His sister had a cold last week. He had his flu shot two months ago.",
        assistant:
          "Thank you for that context. Is Oliver on any medications, and does he have any known allergies?",
      },
      {
        user: "He takes children's Tylenol as needed. No known allergies.",
        assistant:
          "Thank you. I'm flagging this for urgent pediatric review given the fever level and lethargy. Can you provide your insurance ID so we can prioritize this?",
      },
      {
        user: "It's KID-PLAN-4421.",
        assistant:
          "Thank you. Given Oliver's symptoms, I recommend being seen today. A pediatric nurse will call you back within 30 minutes. If his temperature rises above 104°F or his breathing becomes labored, please go to the emergency room immediately.",
      },
    ],
    summary: {
      chief_concern: "High fever (103.2°F) and lethargy in a 4-year-old for 14 hours",
      collected_fields: {
        name: "Oliver Chen (patient), parent calling on behalf",
        dob: "2021-09-03",
        symptoms: "High fever 103.2°F, lethargy, reduced appetite, no rash",
        medications: "Children's Tylenol (PRN)",
        allergies: "None known",
        insurance_id: "KID-PLAN-4421",
        recent_exposures: "Sibling had cold last week; flu shot 2 months ago",
      },
      missing_fields: [],
      escalation_flags: [
        {
          flag: "Pediatric fever above 103°F with lethargy",
          evidence: "Turn 3: 'It's been about 14 hours. His temperature is 103.2 degrees Fahrenheit.' Turn 4: 'He's been very lethargic'",
          severity: "high",
        },
      ],
      session_quality: "needs_review",
      draft_notes:
        "DRAFT — For staff review only. Pediatric intake complete. High-severity escalation flag for fever with lethargy. Patient flagged for same-day pediatric callback. Emergency escalation instructions provided.",
    },
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): Promise<void> {
  return sleep(300 + Math.random() * 500);
}

interface SessionState {
  script: ConversationScript;
  turnIndex: number;
  startedAt: number;
  events: TranscriptEvent[];
}

const activeSessions = new Map<string, SessionState>();

export class MockVoiceProvider implements VoiceProvider {
  async startSession(assistantConfig: {
    purpose: string;
    language: string;
    voice: string;
    tools: string[];
  }): Promise<string> {
    const sessionId = uuidv4();
    const purposeLower = assistantConfig.purpose.toLowerCase();

    const script =
      SCRIPTS.find((s) => s.keywords.some((kw) => purposeLower.includes(kw))) ?? SCRIPTS[1];

    const systemEvent: TranscriptEvent = {
      speaker: "system",
      content: `Session started. Using mock provider with script: ${script.name}`,
      timestampMs: 0,
    };

    activeSessions.set(sessionId, {
      script,
      turnIndex: 0,
      startedAt: Date.now(),
      events: [systemEvent],
    });

    return sessionId;
  }

  async sendAudio(sessionId: string, _audioChunk: Blob): Promise<TranscriptEvent[]> {
    const state = activeSessions.get(sessionId);
    if (!state) {
      throw new Error(`No active session: ${sessionId}`);
    }

    const { script, turnIndex, startedAt } = state;

    if (turnIndex >= script.turns.length) {
      return [];
    }

    const turn = script.turns[turnIndex];
    const now = Date.now();

    await randomDelay();

    const userEvent: TranscriptEvent = {
      speaker: "user",
      content: turn.user,
      timestampMs: now - startedAt,
    };

    await randomDelay();

    const assistantEvent: TranscriptEvent = {
      speaker: "assistant",
      content: turn.assistant,
      timestampMs: Date.now() - startedAt,
    };

    state.turnIndex += 1;
    state.events.push(userEvent, assistantEvent);

    return [userEvent, assistantEvent];
  }

  async endSession(sessionId: string): Promise<SessionResult> {
    const state = activeSessions.get(sessionId);
    if (!state) {
      throw new Error(`No active session: ${sessionId}`);
    }

    const endEvent: TranscriptEvent = {
      speaker: "system",
      content: "Session ended.",
      timestampMs: Date.now() - state.startedAt,
    };

    state.events.push(endEvent);

    const result: SessionResult = {
      transcript: state.events,
      summary: state.script.summary,
      status: state.script.summary.session_quality as "completed" | "failed" | "needs_review",
    };

    activeSessions.delete(sessionId);

    return result;
  }
}
