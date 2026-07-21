import { EventDetailPage } from "@/components/events/event-detail-page";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventDetailPage eventId={eventId} />;
}
