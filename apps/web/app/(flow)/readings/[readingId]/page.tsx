import { ReadingDetailScreen } from "@/features/readings/screens/ReadingDetailScreen";

export default async function ReadingDetailPage({ params }: { params: Promise<{ readingId: string }> }) {
  const { readingId } = await params;
  return <ReadingDetailScreen readingId={readingId} />;
}
