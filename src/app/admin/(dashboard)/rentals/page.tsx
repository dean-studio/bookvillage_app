"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, BookOpen } from "lucide-react";
import { getActiveRentals } from "@/app/actions/rentals";

type ActiveRental = Awaited<ReturnType<typeof getActiveRentals>>[number];

function getDDayBadge(dDay: number) {
  if (dDay < 0) {
    return <Badge variant="destructive">{Math.abs(dDay)}일 연체</Badge>;
  }
  if (dDay === 0) {
    return <Badge variant="destructive">오늘 마감</Badge>;
  }
  if (dDay <= 3) {
    return <Badge className="bg-amber-500 hover:bg-amber-600">D-{dDay}</Badge>;
  }
  return <Badge variant="outline">D-{dDay}</Badge>;
}

export default function AdminRentalsPage() {
  const router = useRouter();
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const data = await getActiveRentals();
      setRentals(data);
      setLoaded(true);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대여중 도서</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            현재 대출 중
            {loaded && (
              <span className="text-sm font-normal text-muted-foreground">
                ({rentals.length}건)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !loaded ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              현재 대출 중인 도서가 없습니다.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서명</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>대출자</TableHead>
                      <TableHead>동/호수</TableHead>
                      <TableHead>대출일</TableHead>
                      <TableHead>반납예정일</TableHead>
                      <TableHead className="text-right">D-Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/admin/books/${r.book.id}`)}
                      >
                        <TableCell className="font-medium">{r.book.title}</TableCell>
                        <TableCell className="font-mono text-xs">{r.book.barcode}</TableCell>
                        <TableCell>{r.user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.user.dong_ho}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.rented_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.due_date).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {getDDayBadge(r.d_day)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {rentals.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 space-y-1.5 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-transform"
                    onClick={() => router.push(`/admin/books/${r.book.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{r.book.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.book.barcode}</p>
                      </div>
                      {getDDayBadge(r.d_day)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.user.name} · {r.user.dong_ho}</span>
                      <span>~{new Date(r.due_date).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
