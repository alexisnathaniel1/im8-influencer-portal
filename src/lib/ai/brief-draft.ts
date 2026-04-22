import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a creative strategist for IM8 Health, a premium supplement brand.
Write influencer content briefs that are:
- Clear and specific about deliverables
- Brand-aligned: science-backed, longevity-focused, honest
- Flexible enough to let the influencer's authentic voice shine
- Optimised for the influencer's niche and platform

Format the brief in clean markdown with these sections:
## Overview
## Why This Partnership
## Deliverables
## Key Messages
## Dos & Don'ts
## Timeline
## Usage Rights & Notes`;

export async function draftBrief(params: {
  influencerName: string;
  platform: string;
  deliverableType?: string | null;
  monthlyRateCents?: number | null;
  totalMonths?: number | null;
  deliverables?: unknown[];
  campaignStart?: string | null;
  campaignEnd?: string | null;
  rationale?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);

  const rateNote = params.monthlyRateCents
    ? `$${(params.monthlyRateCents / 100).toFixed(0)}/mo × ${params.totalMonths ?? "?"} months`
    : "";

  const prompt = `Draft a content brief for IM8 Health influencer partnership:
Influencer: ${params.influencerName}
Platform: ${params.platform}
${params.deliverableType ? `Deliverable type: ${params.deliverableType}` : ""}
${rateNote ? `Rate: ${rateNote}` : ""}
${params.deliverables?.length ? `Deliverables: ${JSON.stringify(params.deliverables)}` : ""}
Campaign: ${params.campaignStart || "TBD"} to ${params.campaignEnd || "TBD"}
Context: ${params.rationale || "Standard influencer partnership"}

Write a comprehensive content brief.`;

  for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_PROMPT });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error(`[ai/brief-draft] ${modelName} failed:`, err);
    }
  }
  return null;
}
