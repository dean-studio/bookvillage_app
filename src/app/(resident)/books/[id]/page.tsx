import { notFound } from "next/navigation";
import { getBookById } from "@/app/actions/books";
import { getShelves } from "@/app/actions/shelves";
import { BookDetailClient } from "./book-detail-client";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBookById(id);
  if (!book) notFound();

  const shelves = await getShelves();

  return <BookDetailClient book={book} shelves={shelves} />;
}
