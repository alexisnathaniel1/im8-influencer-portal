"use client";

import { useState, useEffect } from "react";

const COUNTRIES = [
  "Singapore", "Australia", "United Kingdom", "United States",
  "Canada", "Hong Kong", "New Zealand", "Malaysia", "Other",
];

const EMPTY_FORM = {
  label: "Home",
  recipient_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Singapore",
  is_primary: true,
};

export type MissingCreator = {
  profileId: string;
  name: string;
};

const SESSION_KEY = "im8_shipping_prompt_dismissed";

export default function ShippingPrompt({ creators }: { creators: MissingCreator[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // On mount: open the modal unless we've dismissed for this session, and unless
  // there's no one to prompt for.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (creators.length === 0) return;
    const d = sessionStorage.getItem(SESSION_KEY);
    if (d === "1") {
      setDismissed(true);
      return;
    }
    setModalOpen(true);
  }, [creators.length]);

  // Prefill recipient name on active creator change
  useEffect(() => {
    const active = creators[activeIdx];
    if (active) {
      setForm(f => ({ ...EMPTY_FORM, recipient_name: active.name }));
    }
  }, [activeIdx, creators]);

  const outstanding = creators.filter(c => !resolved.has(c.profileId));

  if (creators.length === 0) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const active = creators[activeIdx];
    if (!active) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/shipping-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, profile_id: active.profileId }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "" }));
        setError(msg || "Failed to save address");
        setSaving(false);
        return;
      }
      const next = new Set(resolved);
      next.add(active.profileId);
      setResolved(next);
      // Advance to next outstanding creator
      const remaining = creators.findIndex((c, i) => i !== activeIdx && !next.has(c.profileId));
      if (remaining === -1) {
        setModalOpen(false);
      } else {
        setActiveIdx(remaining);
      }
    } catch (err) {
      console.error(err);
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function remindLater() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
    setDismissed(true);
    setModalOpen(false);
  }

  function reopen() {
    setModalOpen(true);
    setDismissed(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_KEY);
    }
    // Jump to first outstanding creator
    const idx = creators.findIndex(c => !resolved.has(c.profileId));
    setActiveIdx(idx >= 0 ? idx : 0);
  }

  const shouldShowBanner = outstanding.length > 0 && (dismissed || !modalOpen);

  return (
    <>
      {/* Persistent amber banner (always visible while unresolved) */}
      {shouldShowBanner && (
        <button
          type="button"
          onClick={reopen}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Shipping address needed for {outstanding.length} creator{outstanding.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              IM8 needs a delivery address to send products. Click to add{outstanding.length === 1 ? "" : " for each"}.
            </p>
          </div>
          <span className="text-sm font-medium text-amber-900">Add →</span>
        </button>
      )}

      {/* Full-screen modal */}
      {modalOpen && outstanding.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-im8-burgundy/40 backdrop-blur-sm p-4 sm:p-8">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-im8-stone/40 my-auto">
            <div className="px-6 py-5 border-b border-im8-stone/20">
              <h2 className="text-xl font-bold text-im8-burgundy">Add your shipping address</h2>
              <p className="text-sm text-im8-burgundy/60 mt-1">
                IM8 needs a delivery address so we can send you products for your upcoming collaboration.
              </p>
            </div>

            {/* Creator tabs (only when multiple) */}
            {creators.length > 1 && (
              <div className="flex flex-wrap gap-2 px-6 pt-4">
                {creators.map((c, i) => {
                  const done = resolved.has(c.profileId);
                  const active = i === activeIdx;
                  return (
                    <button
                      key={c.profileId}
                      type="button"
                      onClick={() => !done && setActiveIdx(i)}
                      disabled={done}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        done
                          ? "bg-green-50 border-green-200 text-green-700 cursor-default"
                          : active
                            ? "bg-im8-red text-white border-im8-red"
                            : "bg-white text-im8-burgundy border-im8-stone/40 hover:bg-im8-sand"
                      }`}
                    >
                      {done ? "✓ " : ""}{c.name}
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={save} className="px-6 py-5 space-y-4">
              <p className="text-sm font-medium text-im8-burgundy">
                For: <span className="text-im8-red">{creators[activeIdx]?.name}</span>
              </p>

              <div>
                <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Label</label>
                <select value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40">
                  {["Home", "Office", "Other"].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Full name *" required value={form.recipient_name}
                  onChange={v => setForm(f => ({ ...f, recipient_name: v }))}
                  placeholder="As it appears on ID" />
                <Field label="Phone" value={form.phone}
                  onChange={v => setForm(f => ({ ...f, phone: v }))}
                  placeholder="+65 9123 4567" />
              </div>
              <Field label="Address line 1 *" required value={form.address_line1}
                onChange={v => setForm(f => ({ ...f, address_line1: v }))}
                placeholder="Street address, unit number" />
              <Field label="Address line 2" value={form.address_line2}
                onChange={v => setForm(f => ({ ...f, address_line2: v }))}
                placeholder="Apartment, floor, building (optional)" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City *" required value={form.city}
                  onChange={v => setForm(f => ({ ...f, city: v }))} />
                <Field label="State / Province" value={form.state}
                  onChange={v => setForm(f => ({ ...f, state: v }))} placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Postal code *" required value={form.postal_code}
                  onChange={v => setForm(f => ({ ...f, postal_code: v }))} />
                <div>
                  <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">Country *</label>
                  <select required value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40">
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-im8-stone/20">
                <button type="button" onClick={remindLater}
                  className="text-sm text-im8-burgundy/50 hover:text-im8-burgundy">
                  Remind me later
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-im8-red text-white text-sm font-medium rounded-lg hover:bg-im8-burgundy disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : "Save address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label, value, onChange, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-im8-burgundy/60 mb-1">{label}</label>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
      />
    </div>
  );
}
