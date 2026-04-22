"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface Brief {
  id: string;
  deal_id: string;
  title: string;
  body_markdown: string;
  platform: string | null;
  deliverable_type: string | null;
  due_date: string | null;
  status: string;
  deal: { influencer_name: string; platform_primary: string } | null;
}

export default function BriefEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("briefs")
      .select("*, deal:deal_id(influencer_name, platform_primary)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBrief(data as unknown as Brief);
          setBody(data.body_markdown || "");
          setTitle(data.title || "");
        }
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/briefs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body_markdown: body }),
    });
    setSaving(false);
    setMessage("Saved");
    setTimeout(() => setMessage(""), 2000);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch(`/api/briefs/${id}/generate`, { method: "POST" });
    const data = await res.json();
    if (data.markdown) {
      setBody(data.markdown);
      setMessage("Draft generated — review and save");
    } else {
      setMessage("Generation failed");
    }
    setGenerating(false);
  }

  async function handleSend() {
    setSending(true);
    await fetch(`/api/briefs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body_markdown: body, status: "sent", sent_at: new Date().toISOString() }),
    });
    setBrief((prev) => prev ? { ...prev, status: "sent" } : prev);
    setSending(false);
    setMessage("Brief sent to influencer");
    setTimeout(() => setMessage(""), 3000);
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-im8-offwhite flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-im8-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const deal = brief.deal as { influencer_name: string; platform_primary: string } | null;

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href={`/admin/deals/${brief.deal_id}`} className="text-sm text-im8-red hover:underline mb-1 inline-block">&larr; Back to Deal</Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-im8-burgundy">{title}</h1>
              {deal && <p className="text-sm text-im8-burgundy/60">{deal.influencer_name} · {deal.platform_primary}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${brief.status === "sent" ? "bg-blue-100 text-blue-700" : brief.status === "draft" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                {brief.status}
              </span>
            </div>
          </div>
        </div>

        <Card padding="md" className="mb-4">
          <div className="mb-4">
            <Input label="Brief Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-im8-burgundy">Brief Content (Markdown)</label>
            <Button size="sm" variant="outline" onClick={handleGenerate} loading={generating}>
              ✦ Generate with AI
            </Button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            placeholder="Write the brief in Markdown, or click Generate with AI..."
            className="w-full text-sm font-mono border border-im8-sand rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-im8-red/30 resize-y"
          />
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>Save Draft</Button>
            {brief.status === "draft" && (
              <Button variant="secondary" onClick={handleSend} loading={sending}>
                Send to Influencer
              </Button>
            )}
          </div>
          {message && <p className="text-sm text-im8-burgundy/60">{message}</p>}
        </div>

        {body && (
          <Card padding="md" className="mt-6">
            <h3 className="text-sm font-semibold text-im8-burgundy mb-3">Preview</h3>
            <div className="prose prose-sm max-w-none text-im8-burgundy whitespace-pre-wrap">{body}</div>
          </Card>
        )}
      </div>
    </div>
  );
}
