"use client";

import { useEffect, useState } from "react";

interface AIReview {
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  framework_score: number | null;
  framework_feedback: string | null;
  authenticity_score: number | null;
  authenticity_feedback: string | null;
  algorithm_score: number | null;
  algorithm_feedback: string | null;
  general_notes: string | null;
  recommendation: "approve" | "reject" | "borderline" | null;
  recommendation_reason: string | null;
  brand_compliance_issues: string[] | null;
  detected_content_angle: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  video_size_bytes: number | null;
}

const SCORE_LABELS: Record<number, string> = { 1: "Poor", 2: "Below Avg", 3: "Adequate", 4: "Good", 5: "Excellent" };

function scoreColor(score: number): string {
  if (score <= 2) return "bg-red-500";
  if (score === 3) return "bg-amber-500";
  return "bg-green-500";
}

function ScoreCircles({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-im8-burgundy w-20 shrink-0">{label}</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${n <= score ? `${scoreColor(score)} text-white` : "bg-gray-200 text-gray-400"}`}>
          {n}
        </div>
      ))}
      <span className="text-xs text-im8-burgundy/50 ml-1">{SCORE_LABELS[score]}</span>
    </div>
  );
}

interface AIReviewCardProps {
  submissionId: string;
  onReviewLoaded?: (review: AIReview) => void;
}

export function AIReviewCard({ submissionId, onReviewLoaded }: AIReviewCardProps) {
  const [review, setReview] = useState<AIReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: NodeJS.Timeout | null = null;

    async function fetchReview() {
      try {
        const res = await fetch(`/api/ai-review/${submissionId}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.data) {
          setReview(json.data);
          setLoading(false);
          if (json.data.status === "completed" && onReviewLoaded) onReviewLoaded(json.data);
          if (json.data.status === "pending" || json.data.status === "processing") {
            pollTimer = setTimeout(fetchReview, 5000);
          }
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReview();
    return () => { cancelled = true; if (pollTimer) clearTimeout(pollTimer); };
  }, [submissionId, onReviewLoaded]);

  if (loading) {
    return (
      <div className="mb-4 p-3 rounded-lg border border-im8-sand bg-im8-offwhite/50">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-im8-red border-t-transparent rounded-full" />
          <span className="text-xs text-im8-burgundy/60">Loading AI review...</span>
        </div>
      </div>
    );
  }

  if (!review) return null;

  if (review.status === "pending" || review.status === "processing") {
    return (
      <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
        <div className="flex items-center gap-2">
          <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-800">AI review in progress...</span>
          <span className="text-xs text-amber-600">This may take up to a minute.</span>
        </div>
      </div>
    );
  }

  if (review.status === "failed") {
    return (
      <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-red-800">AI review failed</span>
          {review.error_message && <span className="text-xs text-red-600 truncate max-w-md">{review.error_message}</span>}
        </div>
      </div>
    );
  }

  if (review.status === "skipped") {
    return (
      <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
        <span className="text-xs font-medium text-gray-600">AI review skipped</span>
      </div>
    );
  }

  const recBg = review.recommendation === "approve"
    ? "bg-green-100 text-green-800 border-green-300"
    : review.recommendation === "reject"
    ? "bg-red-100 text-red-800 border-red-300"
    : "bg-amber-100 text-amber-800 border-amber-300";

  const avgScore = review.framework_score && review.authenticity_score && review.algorithm_score
    ? ((review.framework_score + review.authenticity_score + review.algorithm_score) / 3).toFixed(1)
    : null;

  return (
    <div className="mb-4 rounded-lg border border-im8-sand bg-gradient-to-r from-im8-offwhite to-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-im8-sand/20 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-im8-burgundy">AI Review</span>
          {avgScore && <span className="text-xs text-im8-burgundy/50">Avg: {avgScore}/5</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${recBg}`}>
            {review.recommendation === "approve" ? "Approve" : review.recommendation === "reject" ? "Reject" : "Borderline"}
          </span>
          <svg className={`w-4 h-4 text-im8-burgundy/40 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-im8-sand/50">
          {review.recommendation_reason && (
            <p className="text-sm text-im8-burgundy/80 mt-3 italic">&ldquo;{review.recommendation_reason}&rdquo;</p>
          )}
          <div className="space-y-2 mt-3">
            {review.framework_score && (
              <div>
                <ScoreCircles score={review.framework_score} label="Framework" />
                {review.framework_feedback && <p className="text-xs text-im8-burgundy/70 ml-[84px] mt-1">{review.framework_feedback}</p>}
              </div>
            )}
            {review.authenticity_score && (
              <div>
                <ScoreCircles score={review.authenticity_score} label="Authenticity" />
                {review.authenticity_feedback && <p className="text-xs text-im8-burgundy/70 ml-[84px] mt-1">{review.authenticity_feedback}</p>}
              </div>
            )}
            {review.algorithm_score && (
              <div>
                <ScoreCircles score={review.algorithm_score} label="Algorithm" />
                {review.algorithm_feedback && <p className="text-xs text-im8-burgundy/70 ml-[84px] mt-1">{review.algorithm_feedback}</p>}
              </div>
            )}
          </div>
          {review.general_notes && (
            <div className="p-3 rounded-lg bg-im8-offwhite">
              <p className="text-xs font-semibold text-im8-burgundy mb-1">General Notes</p>
              <p className="text-sm text-im8-burgundy/80">{review.general_notes}</p>
            </div>
          )}
          {review.brand_compliance_issues && review.brand_compliance_issues.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-xs font-semibold text-red-800 mb-1">Brand Compliance Issues</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {review.brand_compliance_issues.map((issue, i) => (
                  <li key={i} className="text-xs text-red-700">{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-im8-burgundy/40">
            {review.detected_content_angle && (
              <span className="px-2 py-0.5 bg-im8-sand/50 rounded-full text-im8-burgundy/60">Angle: {review.detected_content_angle}</span>
            )}
            {review.processing_time_ms && <span>Processed in {(review.processing_time_ms / 1000).toFixed(1)}s</span>}
            {review.video_size_bytes && <span>{(review.video_size_bytes / 1024 / 1024).toFixed(1)}MB</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AIReviewBadge({ recommendation, status }: { recommendation: string | null; status: string }) {
  if (status === "pending" || status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
        <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-gray-400" />
        AI...
      </span>
    );
  }
  if (status !== "completed" || !recommendation) return null;
  const colors = recommendation === "approve" ? "bg-green-100 text-green-700" : recommendation === "reject" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  const label = recommendation === "approve" ? "AI: Approve" : recommendation === "reject" ? "AI: Reject" : "AI: Borderline";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors}`}>{label}</span>;
}
