import { GoogleGenerativeAI } from "@google/generative-ai";

export interface EmailSummary {
  summary: string;
  next_steps: string[];
}

const SYSTEM_PROMPT = `You summarize emails for the IM8 Health influencer partnership team.

Context:
- IM8 Health is a premium supplement brand co-founded by David Beckham.
- The team partners with creators (doctors, athletes, biohackers, wellness influencers) for paid sponsorships.
- Their inbox (partners@im8health.com) receives emails from agencies, creators, internal staff, and external parties.
- The team handles outreach, contract negotiation, content review, payment, and ongoing collaboration.

Given an email (which may include quoted reply chains and forwarded content), return ONLY valid JSON in this exact shape:

{
  "summary": "<2-3 sentence summary explaining who sent it, what's happening, and why it matters. Use context from quoted/forwarded content. Don't paraphrase the first sentence — actually summarize the meaning.>",
  "next_steps": ["<Team: ...>" or "<Creator: ...>", ...]
}

Rules:
- summary: 2-3 full sentences. Add context, don't echo the email verbatim. If it's a forwarded thread, summarize the whole conversation, not just the latest message.
- next_steps: max 3 specific actions. Each must start with "Team:" (something the IM8 team needs to do) or "Creator:" (something the creator/external party needs to do). Be concrete — include names, amounts, dates, or invoice numbers if mentioned.
- If purely informational/FYI with no action needed, return next_steps: [].
- Never copy the email's wording. Rephrase as a clear description.`;

export async function summarizeEmail(email: {
  from_name: string | null;
  from_email: string;
  subject: string;
  body_text: string | null;
}): Promise<EmailSummary> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment");
  }

  const fromLabel = email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email;
  const emailText = [
    `From: ${fromLabel}`,
    `Subject: ${email.subject}`,
    `---`,
    email.body_text?.slice(0, 6000) ?? "(no body)",
  ].join("\n");

  // Try newest model first, fall back to stable if it fails
  const modelNames = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];

  for (const modelName of modelNames) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
      });

      const result = await model.generateContent(
        `Summarize this email received at partners@im8health.com:\n\n${emailText}`
      );

      const text = result.response.text();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end === -1) {
        console.warn("[ai/email-summary] Response not valid JSON, raw:", text.slice(0, 300));
        // Throw so the caller sees the actual problem rather than a silent null
        throw new Error(`Gemini (${modelName}) returned non-JSON: "${text.slice(0, 120)}"`);
      }

      const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<EmailSummary>;
      if (typeof parsed.summary !== "string") {
        throw new Error(`Gemini (${modelName}) JSON missing 'summary' field`);
      }

      return {
        summary: parsed.summary,
        next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps.filter(s => typeof s === "string") : [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Model not found / not available for this key → try next
      if (msg.includes("not found") || msg.includes("404") || msg.includes("not supported") || msg.includes("MODEL_NOT_FOUND")) {
        console.warn(`[ai/email-summary] Model ${modelName} unavailable, trying next`);
        continue;
      }
      // Any other error (auth, quota, network, bad JSON) — re-throw so the caller
      // captures the real message instead of receiving a silent null.
      console.error(`[ai/email-summary] Error with ${modelName}:`, err);
      throw err;
    }
  }

  throw new Error("All Gemini models unavailable for this API key — check that GEMINI_API_KEY has access to the Gemini API (not just Google Cloud)");
}
