"use client";

import { useState, useEffect } from "react";

interface SavedAddress {
  id: string;
  label: string;
  is_primary: boolean;
  is_legacy?: boolean;
  recipient_name: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

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
  is_primary: false,
};

export default function ShippingAddressForm({ profileId, defaultName }: { profileId: string; defaultName: string }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newAddr, setNewAddr] = useState({ ...EMPTY_FORM, recipient_name: defaultName });

  async function load() {
    const res = await fetch("/api/shipping-addresses?forSelf=true");
    if (res.ok) {
      const { addresses: list } = await res.json();
      setAddresses(list ?? []);
    }
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function setPrimary(id: string) {
    setSettingPrimary(id);
    await fetch(`/api/shipping-addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
    });
    setSettingPrimary(null);
    load();
  }

  async function deleteAddr(id: string) {
    setDeletingId(id);
    await fetch(`/api/shipping-addresses/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmDeleteId(null);
    load();
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/shipping-addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newAddr, profile_id: profileId }),
    });
    setSaving(false);
    setShowForm(false);
    setNewAddr({ ...EMPTY_FORM, recipient_name: defaultName });
    load();
  }

  const inp = (
    label: string,
    key: keyof typeof newAddr,
    opts?: { required?: boolean; placeholder?: string },
  ) => (
    <div>
      <label className="block text-sm font-medium text-im8-burgundy mb-1">
        {label}{opts?.required ? " *" : ""}
      </label>
      <input
        type="text"
        required={opts?.required}
        placeholder={opts?.placeholder}
        value={String(newAddr[key])}
        onChange={e => setNewAddr(a => ({ ...a, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Saved addresses list */}
      {loaded && addresses.length === 0 && !showForm && (
        <div className="rounded-lg bg-amber-50/60 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          No shipping address saved yet. Add one below so IM8 can send you products.
        </div>
      )}

      {addresses.map(addr => (
        <div key={addr.id}
          className={`rounded-xl border px-4 py-4 ${addr.is_primary ? "border-im8-red/25 bg-im8-red/5" : "border-im8-stone/30 bg-white"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-im8-burgundy">{addr.label}</span>
                {addr.is_primary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-im8-red text-white font-semibold">Primary</span>
                )}
                {addr.is_legacy && (
                  <span className="text-[10px] text-im8-burgundy/40">previously saved</span>
                )}
              </div>
              <div className="text-sm text-im8-burgundy">{addr.recipient_name}</div>
              <div className="text-xs text-im8-burgundy/60 mt-0.5">
                {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}
                {", "}{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}
                {addr.country ? ` · ${addr.country}` : ""}
              </div>
              {addr.phone && <div className="text-xs text-im8-burgundy/40 mt-0.5">{addr.phone}</div>}
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {!addr.is_primary && !addr.is_legacy && (
                <button type="button" onClick={() => setPrimary(addr.id)}
                  disabled={settingPrimary === addr.id}
                  className="text-xs text-im8-burgundy/50 hover:text-im8-red transition-colors disabled:opacity-50">
                  {settingPrimary === addr.id ? "Setting…" : "Set primary"}
                </button>
              )}
              {!addr.is_legacy && (
                confirmDeleteId === addr.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-red-500">Remove?</span>
                    <button type="button" onClick={() => deleteAddr(addr.id)} disabled={deletingId === addr.id}
                      className="text-[10px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                      {deletingId === addr.id ? "…" : "Yes"}
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] text-im8-burgundy/40 hover:text-im8-burgundy">No</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteId(addr.id)}
                    className="text-xs text-im8-burgundy/25 hover:text-red-500 transition-colors">
                    Remove
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add address form */}
      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full py-2.5 border-2 border-dashed border-im8-stone/30 rounded-xl text-sm text-im8-burgundy/50 hover:border-im8-red/30 hover:text-im8-red transition-colors">
          + Add {addresses.length > 0 ? "another" : "a"} shipping address
        </button>
      )}

      {showForm && (
        <form onSubmit={addAddress} className="border border-im8-stone/30 rounded-xl p-5 space-y-4 bg-im8-sand/20">
          <p className="text-sm font-medium text-im8-burgundy">New address</p>

          <div>
            <label className="block text-sm font-medium text-im8-burgundy mb-1">Label</label>
            <select value={newAddr.label} onChange={e => setNewAddr(a => ({ ...a, label: e.target.value }))}
              className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40">
              {["Home", "Office", "Other"].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {inp("Full name", "recipient_name", { required: true, placeholder: "As it appears on ID" })}
            {inp("Phone number", "phone", { placeholder: "+65 9123 4567" })}
          </div>

          {inp("Address line 1", "address_line1", { required: true, placeholder: "Street address, unit number" })}
          {inp("Address line 2", "address_line2", { placeholder: "Apartment, floor, building (optional)" })}

          <div className="grid grid-cols-2 gap-4">
            {inp("City", "city", { required: true })}
            {inp("State / Province", "state", { placeholder: "Optional" })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {inp("Postal code", "postal_code", { required: true })}
            <div>
              <label className="block text-sm font-medium text-im8-burgundy mb-1">Country *</label>
              <select required value={newAddr.country} onChange={e => setNewAddr(a => ({ ...a, country: e.target.value }))}
                className="w-full px-3 py-2 border border-im8-stone/40 rounded-lg text-sm text-im8-burgundy focus:outline-none focus:ring-2 focus:ring-im8-red/40">
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newAddr.is_primary}
              onChange={e => setNewAddr(a => ({ ...a, is_primary: e.target.checked }))}
              className="w-4 h-4 accent-im8-red" />
            <span className="text-sm text-im8-burgundy">Set as primary (used for product deliveries)</span>
          </label>

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-im8-burgundy/50 hover:text-im8-burgundy">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-im8-red hover:bg-im8-burgundy rounded-lg disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
