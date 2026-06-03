import { EstateDetailPage } from "@/components/dashboard/pages";

export default async function Page({
  params
}: {
  params: Promise<{ estateId: string }>;
}) {
  const { estateId } = await params;

  return <EstateDetailPage estateId={decodeURIComponent(estateId)} />;
}
