import Image from "next/image";
import SignOutButton from "@/components/shared/sign-out-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-im8-burgundy px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="bg-im8-burgundy rounded-xl p-4">
              <Image src="/logo-white.svg" alt="IM8" width={80} height={40} priority />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-4xl">⏳</div>
            <h1 className="text-xl font-bold text-im8-burgundy">Account Pending Activation</h1>
            <p className="text-sm text-im8-burgundy/60 leading-relaxed">
              Your account has been created but needs to be activated by an admin before you can access the portal.
              Please reach out to your team lead or manager.
            </p>
          </div>

          <div className="pt-2">
            <SignOutButton className="text-sm text-im8-burgundy/50 hover:text-im8-red transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
