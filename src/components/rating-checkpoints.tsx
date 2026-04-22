"use client";

export interface SubmissionRatings {
  framework_score: number;
  authenticity_score: number;
  algorithm_score: number;
  framework_feedback: string;
  authenticity_feedback: string;
  algorithm_feedback: string;
  general_notes: string;
}

export const DEFAULT_RATINGS: SubmissionRatings = {
  framework_score: 3,
  authenticity_score: 3,
  algorithm_score: 3,
  framework_feedback: "",
  authenticity_feedback: "",
  algorithm_feedback: "",
  general_notes: "",
};

const CHECKPOINTS = [
  { key: "framework" as const, label: "Framework Test", description: "Hook (0-3s) → Middle (feeling/story) → Close (urgency + CTA)", scoreKey: "framework_score" as keyof SubmissionRatings, feedbackKey: "framework_feedback" as keyof SubmissionRatings },
  { key: "authenticity" as const, label: "Real Person Test", description: "Sounds authentic — not scripted, robotic, or AI-generated", scoreKey: "authenticity_score" as keyof SubmissionRatings, feedbackKey: "authenticity_feedback" as keyof SubmissionRatings },
  { key: "algorithm" as const, label: "Algorithm Test", description: "Good hold rate, completion rate, likely to drive action", scoreKey: "algorithm_score" as keyof SubmissionRatings, feedbackKey: "algorithm_feedback" as keyof SubmissionRatings },
];

const SCORE_LABELS: Record<number, string> = { 1: "Poor", 2: "Below Avg", 3: "Adequate", 4: "Good", 5: "Excellent" };

function scoreRingColor(score: number, active: boolean): string {
  if (!active) return "bg-gray-200";
  if (score <= 2) return "bg-red-500";
  if (score === 3) return "bg-amber-500";
  return "bg-green-500";
}

interface RatingCheckpointsProps {
  ratings: SubmissionRatings;
  onChange?: (ratings: SubmissionRatings) => void;
  readOnly?: boolean;
}

export function RatingCheckpoints({ ratings, onChange, readOnly = false }: RatingCheckpointsProps) {
  function update(key: keyof SubmissionRatings, value: string | number) {
    if (readOnly || !onChange) return;
    onChange({ ...ratings, [key]: value });
  }

  return (
    <div className="space-y-5">
      {CHECKPOINTS.map((cp) => {
        const score = ratings[cp.scoreKey] as number;
        return (
          <div key={cp.key} className="border border-im8-sand rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 className="text-sm font-semibold text-im8-burgundy">{cp.label}</h4>
                <p className="text-xs text-im8-burgundy/60 mt-0.5">{cp.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={readOnly}
                  onClick={() => update(cp.scoreKey, n)}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${n <= score ? `${scoreRingColor(score, true)} text-white` : "bg-gray-200 text-gray-500"} ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
                >
                  {n}
                </button>
              ))}
              {!readOnly && <span className="text-xs text-im8-burgundy/50 ml-2">{SCORE_LABELS[score]}</span>}
            </div>
            {readOnly ? (
              (ratings[cp.feedbackKey] as string) ? (
                <p className="text-sm text-im8-burgundy/80 bg-im8-offwhite rounded p-2">{ratings[cp.feedbackKey] as string}</p>
              ) : null
            ) : (
              <textarea
                value={ratings[cp.feedbackKey] as string}
                onChange={(e) => update(cp.feedbackKey, e.target.value)}
                placeholder={`Feedback for ${cp.label.toLowerCase()}...`}
                rows={2}
                className="w-full text-sm border border-im8-sand rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
              />
            )}
          </div>
        );
      })}
      <div className="border border-im8-sand rounded-lg p-4 bg-white">
        <h4 className="text-sm font-semibold text-im8-burgundy mb-2">General Notes</h4>
        {readOnly ? (
          ratings.general_notes ? (
            <p className="text-sm text-im8-burgundy/80 bg-im8-offwhite rounded p-2">{ratings.general_notes}</p>
          ) : (
            <p className="text-xs text-im8-burgundy/40 italic">No additional notes</p>
          )
        ) : (
          <textarea
            value={ratings.general_notes}
            onChange={(e) => update("general_notes", e.target.value)}
            placeholder="Overall feedback, coaching tips, etc..."
            rows={3}
            className="w-full text-sm border border-im8-sand rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-none"
          />
        )}
      </div>
    </div>
  );
}
