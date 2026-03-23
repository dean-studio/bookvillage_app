"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { getBookDeletions } from "@/app/actions/books";

type DeletionItem = {
  id: string;
  book_title: string;
  book_barcode: string;
  book_author: string | null;
  deleted_at: string;
  profiles: { name: string } | null;
};

const PAGE_SIZE = 20;

export default function AdminDeletionsPage() {
  const [deletions, setDeletions] = useState<DeletionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, startLoading] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    startLoading(async () => {
      const result = await getBookDeletions(currentPage, PAGE_SIZE);
      setDeletions(result.deletions as DeletionItem[]);
      setTotalCount(result.totalCount);
    });
  }, [currentPage]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">도서 삭제 내역</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="size-4" />
            삭제된 도서 ({totalCount}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : deletions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              삭제 내역이 없습니다.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서명</TableHead>
                      <TableHead>저자</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>삭제자</TableHead>
                      <TableHead className="text-right">삭제일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.book_title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.book_author || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.book_barcode}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.profiles?.name || "알 수 없음"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {new Date(item.deleted_at).toLocaleString("ko-KR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {deletions.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-3 space-y-1"
                  >
                    <p className="text-sm font-medium">{item.book_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.book_author || "-"} · {item.book_barcode}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {item.profiles?.name || "알 수 없음"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.deleted_at).toLocaleString("ko-KR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
