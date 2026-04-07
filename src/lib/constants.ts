export const APPROVED_TOOLS = [
  {
    id: "symptom_lookup",
    name: "Symptom Reference Lookup",
    description: "Look up general symptom information from an approved knowledge base",
  },
  {
    id: "appointment_check",
    name: "Appointment Availability",
    description: "Check available appointment slots for a service line",
  },
  {
    id: "form_prefill",
    name: "Intake Form Pre-fill",
    description: "Pre-fill intake form fields from collected session data",
  },
] as const;

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
] as const;

export const VOICES = [
  { value: "default", label: "Default" },
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "clinical", label: "Clinical" },
] as const;

export const SESSION_STATUSES = [
  "initializing",
  "active",
  "ending",
  "completed",
  "failed",
  "needs_review",
] as const;

export const ASSISTANT_STATUSES = ["draft", "published", "archived"] as const;

export const MEMORY_MODES = [
  {
    value: "full",
    label: "Full history",
    description: "Sends the complete conversation history to the model each turn. Best for accuracy on short sessions.",
  },
  {
    value: "window",
    label: "Sliding window",
    description: "Keeps only the last 20 messages (≈10 turns). Reduces cost and latency on long sessions.",
  },
] as const;
