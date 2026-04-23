import { redirect } from "next/navigation";
export default function InfluencerBriefRedirect({ params }: { params: { id: string } }) {
  redirect(`/partner/briefs/${params.id}`);
}
