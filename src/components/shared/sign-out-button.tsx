"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <button
      onClick={signOut}
      className={className ?? "text-im8-burgundy/60 hover:text-im8-red"}
    >
      Sign out
    </button>
  );
}
