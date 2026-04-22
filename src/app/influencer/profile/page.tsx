"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Profile {
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function InfluencerProfilePage() {
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user.id);
      setMessage("Saved");
      setTimeout(() => setMessage(""), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-im8-offwhite">
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-im8-burgundy mb-6">My Profile</h1>
        <Card padding="lg">
          <div className="space-y-4">
            <Input label="Full Name" value={profile.full_name || ""} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} />
            <Input label="Email" value={profile.email || ""} disabled hint="Contact your IM8 account manager to change your email." />
            <Input label="Phone" value={profile.phone || ""} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="flex items-center gap-4 mt-6">
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
            {message && <span className="text-sm text-im8-burgundy/60">{message}</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
