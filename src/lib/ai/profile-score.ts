import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ProfileScore {
  score: number;
  summary: string;
  red_flags: string[];
  niche_tags: string[];
  suggested_rate_range_usd: [number, number];
}

const SYSTEM_PROMPT = `You are a talent evaluator for IM8 Health, a premium supplement brand.
Assess influencer profiles against these criteria:
- Niche fit: doctors, dietitians, athletes, biohackers, Hyrox, wellness, longevity
- Platform presence: primarily Instagram and TikTok (YouTube secondary)
- Ideal: under 500k followers but strong engagement; micro-influencers (10k-100k) with authentic communities
- Red flags: crypto promotion, weight-loss scam products, misleading health claims, purchased followers, very low engagement rate (<1%)

Return ONLY valid JSON:
{
  "score": <0-100 integer>,
  "summary": "<2-3 sentence evaluation>",
  "red_flags": ["<flag1>", ...],
  "niche_tags": ["<tag1>", ...],
  "suggested_rate_range_usd": [<min>, <max>]
}`;

export async function scoreProfile(profileData: {
  influencerName: string;
  platform: string;
  igHandle?: string | null;
  tiktokHandle?: string | null;
  youtubeHandle?: string | null;
  followerCount?: number | null;
  engagementRate?: number | null;
  niche?: string[];
  proposedRateUsd?: number | null;
  portfolioLinks?: string[];
  agencyName?: string | null;
  pitchSummary?: string | null;
}): Promise<ProfileScore | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const profileText = JSON.stringify(profileData, null, 2);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(
      `Evaluate this influencer profile for IM8 Health:\n\n${profileText}`
    );

    const text = result.response.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1)) as ProfileScore;
    }
  } catch (err) {
    console.error("[ai/profile-score] Error:", err);
  }
  return null;
}
