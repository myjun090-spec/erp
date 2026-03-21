import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  redirect(`/safety/hse/${incidentId}`);
}
