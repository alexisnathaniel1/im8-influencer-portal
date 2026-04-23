"use client";

import { useState } from "react";

interface Props {
  initialAddress: Record<string, string>;
  defaultName: string;
}

export default function ShippingAddressForm({ initialAddress, defaultName }: Props) {
  const [form, setForm] = useState({
    recipient_name: initialAddress.recipient_name ?? defaultName,
    phone: initialAddress.phone ?? "",
    address_line1: initialAddress.address_line1 ?? "",
    address_line2: initialAddress.address_line2 ?? "",
    city: initialAddress.city ?? "",
    state: initialAddress.state ?? "",
    postal_code: initialAddress.postal_code ?? "",
    country: initialAddress.country ?? "Singapore",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/partner/shipping-address", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to save. Please try again.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string; required?: boolean }) => (
    <div>
      <label className="block text-sm font-medium text-im8-burgundy mb-1">
        {label}{opts?.required && " *"}
      </label>
      <input
        type="text"
        value={form[key]}
        placeholder={opts?.placeholder}
        required={opts?.required}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
      />
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field("Full name", "recipient_name", { required: true, placeholder: "As it appears on ID" })}
        {field("Phone number", "phone", { placeholder: "+65 9123 4567" })}
      </div>

      {field("Address line 1", "address_line1", { required: true, placeholder: "Street address, unit number" })}
      {field("Address line 2", "address_line2", { placeholder: "Apartment, floor, building (optional)" })}

      <div className="grid grid-cols-2 gap-4">
        {field("City", "city", { required: true })}
        {field("State / Province", "state", { placeholder: "Optional" })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field("Postal code", "postal_code", { required: true })}
        <div>
          <label className="block text-sm font-medium text-im8-burgundy mb-1">Country *</label>
          <select
            value={form.country}
            onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
          >
            {["Singapore", "Australia", "United Kingdom", "United States", "Canada", "Hong Kong", "New Zealand", "Malaysia", "Other"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
            saved ? "bg-green-600" : "bg-im8-red hover:bg-im8-burgundy"
          }`}
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save address"}
        </button>
      </div>
    </form>
  );
}
