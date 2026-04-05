import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAssistantSchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1),
  language: z.string().min(1),
  voice: z.string().min(1),
  tools: z.array(z.string()).default([]),
});

export const updateAssistantSchema = createAssistantSchema.partial();

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAssistantInput = z.infer<typeof createAssistantSchema>;
export type UpdateAssistantInput = z.infer<typeof updateAssistantSchema>;
