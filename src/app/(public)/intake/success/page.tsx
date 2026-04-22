import Image from "next/image";
import Link from "next/link";

export default async function IntakeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; duplicates?: string }>;
}) {
  const params = await searchParams;
  const submitted = parseInt(params.submitted ?? "1");
  const duplicates = parseInt(params.duplicates ?? "0");

  return (
    <div className="min-h-screen bg-im8-burgundy flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-white/10 rounded-xl p-4">
            <Image src="/logo-white.svg" alt="IM8" width={80} height={40} />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-8 space-y-4">
          <div className="text-4xl">✓</div>
          <h1 className="text-2xl font-bold text-im8-burgundy">
            {submitted === 1 ? "Profile received" : `${submitted} profiles received`}
          </h1>
          <p className="text-im8-burgundy/70 text-sm leading-relaxed">
            Thank you for submitting. Our team reviews all profiles and will be in touch within 5 business days if there&apos;s a fit.
          </p>
          {duplicates > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              {duplicates === 1
                ? "1 profile was already in our system and wasn't re-submitted."
                : `${duplicates} profiles were already in our system and weren't re-submitted.`}
            </div>
          )}
          <p className="text-xs text-im8-burgundy/50">
            Questions? <a href="mailto:creators@im8health.com" className="underline">creators@im8health.com</a>
          </p>
        </div>
        <Link href="/intake" className="text-im8-stone/70 text-sm hover:text-white transition-colors">
          Submit more profiles →
        </Link>
      </div>
    </div>
  );
}
