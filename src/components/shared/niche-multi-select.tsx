"use client";

import { useState, useRef, useEffect } from "react";

// Keep in sync with the intake form NICHES list.
export const NICHES = [
  "Doctor/Physician",
  "Dietitian/Nutritionist",
  "Athlete",
  "Biohacker",
  "Hyrox/CrossFit",
  "Wellness",
  "Longevity",
  "Fitness Coach",
  "Pilates",
  "Yoga",
  "Padel",
  "Pickleball",
  "Ironman",
  "Lifestyle",
  "Others",
] as const;

export default function NicheMultiSelect({
  value,
  onChange,
  placeholder = "Select niches…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle(tag: string) {
    if (value.includes(tag)) onChange(value.filter(v => v !== tag));
    else onChange([...value, tag]);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[2.5rem] px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy bg-white text-left focus:outline-none focus:ring-2 focus:ring-im8-red/40 flex items-center justify-between gap-2"
      >
        <span className="flex-1 flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-im8-burgundy/40">{placeholder}</span>
          ) : (
            value.map(tag => (
              <span key={tag} className="text-xs bg-im8-sand text-im8-burgundy px-2 py-0.5 rounded-full flex items-center gap-1">
                {tag}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${tag}`}
                  onClick={e => { e.stopPropagation(); toggle(tag); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggle(tag); } }}
                  className="text-im8-burgundy/40 hover:text-red-600 cursor-pointer"
                >×</span>
              </span>
            ))
          )}
        </span>
        <span className="text-im8-burgundy/40 text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-im8-stone/30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {NICHES.map(tag => {
            const active = value.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                  active ? "bg-im8-red/5 text-im8-red font-medium" : "text-im8-burgundy hover:bg-im8-sand/50"
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${active ? "bg-im8-red border-im8-red" : "border-im8-stone/40"}`}>
                  {active && <span className="text-white text-xs leading-none">✓</span>}
                </span>
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
