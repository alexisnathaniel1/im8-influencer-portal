import { GoogleGenerativeAI } from "@google/generative-ai";

export interface EmailSummary {
  summary: string;
  next_steps: string[];
}

const SYSTEM_PROMPT = `You are an assistant for the IM8 Health influencer partnership team.
IM8 is a premium health supplement brand that partners with influencers (doctors, dietitians, athletes, biohackers, wellness creators).
The inbox is partners@im8health.com — it receives emails from agencies, creators, and external parties.

When given an email, return ONLY valid JSON in this exact shape:
{
  "summary": "<1-2 sentence plain English summary of what this email is about and who sent it>",
  "next_steps": ["<specific action>", ...]
}

Rules for next_steps:
- Max 3 items
- Each step should be a concrete action (e.g. "Reply to confirm rates", "Send brief to creator", "Forward to legal for contract review")
- Assign clearly: prefix with "Team:" or "Creator:" to indicate who needs to act
- If no action is needed (e.g. purely informational or spam), return an empty array []
- Never repeat information already in the summary`;

export async function summarizeEmail(email: {
  from_name: string | null;
  from_email: string;
  subject: string;
  body_text: string | null;
}): Promise<EmailSummary | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const emailText = [
    `From: ${email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}`,
    `Subject: ${email.subject}`,
    `---`,
    email.body_text?.slice(0, 4000) ?? "(no body)",
  ].join("\n");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(
      `Summarize this email received at partners@im8health.com:\n\n${emailText}`
    );

    const text = result.response.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1)) as EmailSummary;
    }
  } catch (err) {
    console.error("[ai/email-summary] Error:", err);
  }
  return null;
}
