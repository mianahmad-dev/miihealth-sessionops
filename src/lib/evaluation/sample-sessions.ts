import type { StartSessionConfig } from "@/lib/voice/types";

export interface SampleTurn {
  userText: string;
}

export interface SampleExpectations {
  /** Whether this session should produce at least one escalation flag */
  hasEscalation: boolean;
  /** Expected session_quality in the summary */
  sessionQuality: "completed" | "needs_review";
}

export interface SampleSession {
  id: string;
  name: string;
  config: StartSessionConfig;
  turns: SampleTurn[];
  expectations: SampleExpectations;
}

export const SAMPLE_SESSIONS: SampleSession[] = [
  {
    id: "complete-intake",
    name: "Complete Normal Intake",
    config: {
      purpose:
        "Collect patient intake information: full name, date of birth, chief concern, current medications, known allergies, and insurance ID.",
      language: "en",
      voice: "professional",
      tools: [],
      memoryMode: "full",
    },
    turns: [
      { userText: "Hi, my name is John Smith and I was born on March 15, 1985." },
      { userText: "I'm here because I've had a persistent headache for the last three days." },
      { userText: "I take ibuprofen and lisinopril daily." },
      { userText: "I'm allergic to penicillin." },
      { userText: "My insurance ID is BCBS-123456." },
      { userText: "Yes, that's everything." },
    ],
    expectations: {
      hasEscalation: false,
      sessionQuality: "completed",
    },
  },
  {
    id: "escalation-chest-pain",
    name: "Escalation: Chest Pain + Arm Radiation",
    config: {
      purpose: "Collect patient intake information for a cardiology pre-visit screening.",
      language: "en",
      voice: "clinical",
      tools: ["symptom_lookup"],
      memoryMode: "full",
    },
    turns: [
      { userText: "I'm calling because I have chest pain that started about an hour ago." },
      { userText: "Yes, it's radiating down my left arm and I feel short of breath." },
      { userText: "I don't have any known allergies." },
    ],
    expectations: {
      hasEscalation: true,
      sessionQuality: "needs_review",
    },
  },
  {
    id: "tool-use-appointment",
    name: "Tool Use: Appointment Availability Check",
    config: {
      purpose:
        "Help patients find available appointment slots and collect their name and date of birth for pre-registration.",
      language: "en",
      voice: "friendly",
      tools: ["appointment_check"],
      memoryMode: "window",
    },
    turns: [
      { userText: "Hi, I'd like to check when there are openings for cardiology." },
      { userText: "My name is Sarah Johnson." },
      { userText: "I was born on June 5, 1990." },
    ],
    expectations: {
      hasEscalation: false,
      sessionQuality: "needs_review", // partial — most fields not collected
    },
  },
  {
    id: "resistant-patient",
    name: "Resistant Patient — Partial Intake",
    config: {
      purpose: "Collect full patient intake information before a general practice appointment.",
      language: "en",
      voice: "professional",
      tools: [],
      memoryMode: "full",
    },
    turns: [
      { userText: "I don't want to give my personal information right now." },
      { userText: "Can you just book me an appointment?" },
      { userText: "Fine, I have a sore throat." },
    ],
    expectations: {
      hasEscalation: false,
      sessionQuality: "needs_review",
    },
  },
  {
    id: "window-memory",
    name: "Window Memory Mode — Multi-turn Intake",
    config: {
      purpose: "Collect full patient intake including name, DOB, symptoms, medications, allergies, and insurance.",
      language: "en",
      voice: "default",
      tools: [],
      memoryMode: "window",
    },
    turns: [
      { userText: "My name is Alice Chen." },
      { userText: "I was born on January 10, 1975." },
      { userText: "I have a sore throat and mild fever." },
      { userText: "I'm not on any medications currently." },
      { userText: "No known allergies." },
      { userText: "My insurance is Aetna, ID 789012." },
    ],
    expectations: {
      hasEscalation: false,
      sessionQuality: "completed",
    },
  },
];
