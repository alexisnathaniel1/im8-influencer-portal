"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Deliverable = {
  id: string;
  deliverable_type: string;
  platform: string;
  title: string | null;
  status: string;
  due_date: string | null;
  is_story: boolean;
  deal: {
    id: string;
    influencer_name: string;
    platform_primary: string;
    status: string;
  } | null;
};

export default function EditorDeliverableCard({
  deliverable,
  uploadCount,
}: {
  deliverable: Deliverable;
  uploadCount: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const deal = deliverable.deal;
  if (!deal) return null;

  function onFilesSelected(selected: FileList | null) {
    if (!selected) return;
    setFiles(Array.from(selected));
    setDone(false);
    setError("");
  }

  async function uploadAll() {
    if (!files.length || !deal) return;
    setUploading(true);
    setError("");
    setProgress(new Array(files.length).fill(0));

    let anyError = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Canonical name: influencer_dealShort_deliverableType_seq.ext
        const ext = file.name.split(".").pop() ?? "mp4";
        const safeName = deal.influencer_name.replace(/\s+/g, "_").toLowerCase();
        const dealShort = deal.id.slice(0, 6);
        const seq = uploadCount + i + 1;
        const canonicalFileName = `${safeName}_${dealShort}_${deliverable.deliverable_type}_${String(seq).padStart(3, "0")}.${ext}`;

        // Get upload session — folder resolution is based on the deal
        const sessionRes = await fetch("/api/drive/upload-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: deal.id,
            mimeType: file.type || "video/mp4",
            fileSize: file.size,
          }),
        });
        if (!sessionRes.ok) throw new Error((await sessionRes.json()).error || "Upload session failed");
        const { sessionUri, fileName } = await sessionRes.json();

        // Upload to Drive
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
              setProgress(prev => prev.map((p, idx) => idx === i ? Math.round((e.loaded / e.total) * 90) : p));
            }
          };
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Drive upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.open("PUT", sessionUri);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.send(file);
        });

        // Get Drive file info
        const infoRes = await fetch(`/api/drive/file-info?fileName=${encodeURIComponent(fileName)}&dealId=${deal.id}`);
        const { fileId, fileUrl } = infoRes.ok ? await infoRes.json() : { fileId: fileName, fileUrl: "" };

        // Record the upload — tied to this specific deliverable
        await fetch("/api/edited-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: deal.id,
            deliverableId: deliverable.id,
            driveFileId: fileId || fileName,
            driveUrl: fileUrl || "",
            originalFileName: file.name,
            canonicalFileName,
          }),
        });

        setProgress(prev => prev.map((p, idx) => idx === i ? 100 : p));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        anyError = true;
      }
    }

    setUploading(false);
    if (!anyError) {
      setDone(true);
      setFiles([]);
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-xl border border-im8-stone/30 p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-im8-burgundy">{deal.influencer_name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs bg-im8-sand px-2 py-0.5 rounded text-im8-burgundy">
              {deliverable.deliverable_type}
            </span>
            {deliverable.is_story && <span className="text-xs text-im8-burgundy/40">story</span>}
            <span className="text-xs text-im8-burgundy/50 capitalize">{deliverable.platform}</span>
            {deliverable.due_date && (
              <span className="text-xs text-im8-burgundy/50">
                · due {new Date(deliverable.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {deliverable.title && (
            <p className="text-sm text-im8-burgundy/60 mt-1">{deliverable.title}</p>
          )}
        </div>
        <span className="text-xs bg-im8-sand text-im8-burgundy px-3 py-1 rounded-full shrink-0">
          {uploadCount} video{uploadCount !== 1 ? "s" : ""} uploaded
        </span>
      </div>

      {/* Upload zone */}
      <div
        className="border-2 border-dashed border-im8-stone rounded-xl p-6 text-center cursor-pointer hover:border-im8-red/50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFilesSelected(e.dataTransfer.files); }}
      >
        <input ref={fileRef} type="file" accept="video/*" multiple className="hidden"
          onChange={e => onFilesSelected(e.target.files)} />
        {files.length > 0 ? (
          <div className="space-y-1">
            {files.map((f, i) => (
              <div key={i} className="text-sm text-im8-burgundy">
                {f.name} <span className="text-im8-burgundy/40">({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-im8-burgundy font-medium">Drop edited videos here</p>
            <p className="text-sm text-im8-burgundy/50 mt-1">or click to browse · multiple files supported</p>
          </div>
        )}
      </div>

      {/* Progress bars */}
      {uploading && progress.map((p, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs text-im8-burgundy/60 mb-1">
            <span>{files[i]?.name}</span><span>{p}%</span>
          </div>
          <div className="h-1.5 bg-im8-sand rounded-full overflow-hidden">
            <div className="h-full bg-im8-red rounded-full transition-all" style={{ width: `${p}%` }} />
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-600">All videos uploaded successfully ✓</p>}

      {files.length > 0 && !uploading && (
        <button onClick={uploadAll}
          className="w-full py-2.5 bg-im8-red text-white font-medium rounded-lg hover:bg-im8-burgundy transition-colors">
          Upload {files.length} video{files.length !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
