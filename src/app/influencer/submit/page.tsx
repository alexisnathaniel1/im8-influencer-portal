"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Deal = { id: string; influencer_name: string; platform_primary: string; status: string };

function SubmitForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillDealId = searchParams.get("dealId") || "";
  const prefillBriefId = searchParams.get("briefId") || "";

  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState(prefillDealId);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/influencer/deals")
      .then(r => r.json())
      .then(d => setDeals(d.deals ?? []));
  }, []);

  async function computeHash(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress(0);

    try {
      const fileHash = await computeHash(file);

      const sessionRes = await fetch("/api/drive/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefId: prefillBriefId || undefined,
          dealId: selectedDealId || undefined,
          mimeType: file.type || "video/mp4",
          fileSize: file.size,
          fileHash,
        }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        throw new Error(err.error || "Failed to start upload");
      }
      const { sessionUri, fileName } = await sessionRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Drive upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", sessionUri);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      setProgress(95);

      const completeRes = await fetch("/api/drive/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefId: prefillBriefId || undefined,
          dealId: selectedDealId || undefined,
          fileName,
          fileHash,
        }),
      });
      if (!completeRes.ok) {
        const err = await completeRes.json();
        throw new Error(err.error || "Failed to record submission");
      }

      setProgress(100);
      router.push(prefillBriefId ? `/influencer/briefs/${prefillBriefId}` : "/influencer/submissions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="max-w-xl animate-fade-in">
      <div className="mb-6">
        <Link href="/influencer" className="text-sm text-im8-red hover:underline mb-1 inline-block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-im8-burgundy">Upload content</h1>
        <p className="text-im8-burgundy/50 text-sm mt-1">Upload a video for review. No brief required.</p>
      </div>

      <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
        {/* Deal selector */}
        <div>
          <label className="block text-sm font-medium text-im8-burgundy mb-1">
            Which collaboration is this for? <span className="text-im8-burgundy/40 font-normal">(optional)</span>
          </label>
          <select
            value={selectedDealId}
            onChange={e => setSelectedDealId(e.target.value)}
            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40 bg-white"
          >
            <option value="">No specific collaboration (general upload)</option>
            {deals.map(d => (
              <option key={d.id} value={d.id}>
                {d.influencer_name} — {d.platform_primary}
              </option>
            ))}
          </select>
        </div>

        {/* File drop zone */}
        <div
          className="border-2 border-dashed border-im8-stone rounded-xl p-8 text-center cursor-pointer hover:border-im8-red/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        >
          <input ref={fileRef} type="file" accept="video/*" className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div>
              <p className="font-medium text-im8-burgundy">{file.name}</p>
              <p className="text-sm text-im8-burgundy/50 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div>
              <svg className="w-10 h-10 text-im8-stone mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-im8-burgundy font-medium">Drop your video here</p>
              <p className="text-sm text-im8-burgundy/50 mt-1">or click to browse</p>
            </div>
          )}
        </div>

        {uploading && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-im8-burgundy">Uploading…</span>
              <span className="text-sm text-im8-burgundy">{progress}%</span>
            </div>
            <div className="h-2 bg-im8-sand rounded-full overflow-hidden">
              <div className="h-full bg-im8-red rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full py-2.5 bg-im8-red text-white font-semibold rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense>
      <SubmitForm />
    </Suspense>
  );
}
