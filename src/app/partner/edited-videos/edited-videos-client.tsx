"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Video = {
  id: string;
  deal_id: string;
  original_file_name: string;
  canonical_file_name: string;
  drive_url: string;
  admin_status: string;
  influencer_status: string;
  created_at: string;
};

const ADMIN_STATUS_LABELS: Record<string, string> = {
  pending: "Pending IM8 review",
  approved: "Approved by IM8",
  rejected: "Rejected by IM8",
  revision_requested: "Revisions requested",
};

const ADMIN_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
};

export default function EditedVideosClient({ videos, dealMap }: { videos: Video[]; dealMap: Record<string, string> }) {
  if (videos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-im8-stone/30 p-12 text-center text-im8-burgundy/40">
        No edited videos yet. The IM8 editing team will upload videos here for your review.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videos.map(video => (
        <VideoCard key={video.id} video={video} dealName={dealMap[video.deal_id] ?? "Your deal"} />
      ))}
    </div>
  );
}

function VideoCard({ video, dealName }: { video: Video; dealName: string }) {
  const router = useRouter();
  const [comments, setComments] = useState<{ id: string; author_display_name: string; body: string; created_at: string }[]>([]);
  const [showThread, setShowThread] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [acting, setActing] = useState(false);
  const [localStatus, setLocalStatus] = useState(video.influencer_status);

  async function loadComments() {
    if (loaded) return;
    const res = await fetch(`/api/edited-videos/${video.id}/comments`);
    const { comments: c } = await res.json();
    setComments(c);
    setLoaded(true);
  }

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/edited-videos/${video.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments(c => [...c, comment]);
      setNewComment("");
    }
    setPosting(false);
  }

  async function updateStatus(status: string) {
    setActing(true);
    await fetch(`/api/edited-videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ influencer_status: status }),
    });
    setLocalStatus(status);
    setActing(false);
    router.refresh();
  }

  const canReview = video.admin_status === "approved" && localStatus === "pending";

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-im8-burgundy truncate">{video.canonical_file_name}</div>
          <div className="text-xs text-im8-burgundy/50 mt-0.5">
            {dealName} · {new Date(video.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div className="text-xs text-im8-burgundy/40 mt-0.5">Original: {video.original_file_name}</div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ADMIN_STATUS_COLORS[video.admin_status] ?? "bg-gray-100 text-gray-600"}`}>
            {ADMIN_STATUS_LABELS[video.admin_status] ?? video.admin_status}
          </span>
          {localStatus === "approved" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">You approved ✓</span>
          )}
          {localStatus === "rejected" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">You rejected</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {video.drive_url && (
          <a href={video.drive_url} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-im8-sand text-im8-burgundy text-sm rounded-lg hover:bg-im8-stone transition-colors">
            Watch video ↗
          </a>
        )}
        {canReview && (
          <>
            <button onClick={() => updateStatus("approved")} disabled={acting}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              Greenlight ✓
            </button>
            <button onClick={() => updateStatus("rejected")} disabled={acting}
              className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors">
              Request changes
            </button>
          </>
        )}
        <button onClick={() => { setShowThread(!showThread); loadComments(); }}
          className="ml-auto text-xs text-im8-burgundy/50 hover:text-im8-burgundy">
          {showThread ? "Hide" : "Comments"} {comments.length > 0 && `(${comments.length})`}
        </button>
      </div>

      {showThread && (
        <div className="border-t border-im8-stone/20 pt-3 space-y-3">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.length === 0 && <p className="text-xs text-im8-burgundy/30">No comments yet.</p>}
            {comments.map(c => (
              <div key={c.id} className="text-xs space-y-0.5">
                <div className="flex gap-2 items-center">
                  <span className="font-medium text-im8-burgundy">{c.author_display_name}</span>
                  <span className="text-im8-burgundy/30">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-im8-burgundy/70 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newComment} onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && postComment()}
              placeholder="Leave a comment..."
              className="flex-1 px-3 py-1.5 text-xs border border-im8-stone/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-im8-red/40" />
            <button onClick={postComment} disabled={posting || !newComment.trim()}
              className="px-3 py-1.5 bg-im8-red text-white text-xs rounded-lg hover:bg-im8-burgundy disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
