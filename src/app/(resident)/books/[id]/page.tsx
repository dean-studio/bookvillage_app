import { notFound } from "next/navigation";
import { getBookById } from "@/app/actions/books";
import { getShelves } from "@/app/actions/shelves";
import { getPublicSettings } from "@/app/actions/settings";
import { isFlagOn } from "@/lib/site-mode";
import { BookDetailClient } from "./book-detail-client";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBookById(id);
  if (!book) notFound();

  const [shelves, settings] = await Promise.all([getShelves(), getPublicSettings()]);

  return <BookDetailClient book={book} shelves={shelves} arEnabled={isFlagOn(settings, "ar_enabled")} />;
}
