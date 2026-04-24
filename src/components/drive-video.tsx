"use client";

import { useState } from "react";

interface DriveVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  fileId: string;
  /** Optional direct Drive web-view URL used as the "Open in Drive" fallback link */
  driveUrl?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
}

export function DriveVideo({
  fileId,
  driveUrl,
  containerClassName,
  containerStyle,
  ...videoProps
}: DriveVideoProps) {
  const [errored, setErrored] = useState(false);

  const fallbackHref =
    driveUrl ?? `https://drive.google.com/file/d/${fileId}/view`;

  if (errored) {
    return (
      <div
        className={containerClassName}
        style={containerStyle}
      >
        <div className="flex flex-col items-center justify-center gap-2 bg-im8-sand/60 rounded-lg p-6 text-center text-sm text-im8-burgundy/70">
          <svg className="w-8 h-8 text-im8-burgundy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <p className="text-xs">Preview unavailable in browser</p>
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-im8-red hover:underline font-medium"
          >
            Open in Google Drive ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} style={containerStyle}>
      <video
        src={`/api/drive/video/${fileId}`}
        onError={() => setErrored(true)}
        {...videoProps}
      />
    </div>
  );
}
