import { PublicRsvpPage } from "@/components/events/public-rsvp-page";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <PublicRsvpPage eventId={eventId} />;
}
