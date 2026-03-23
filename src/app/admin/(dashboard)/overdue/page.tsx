"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { getOverdueList } from "@/app/actions/stats";
import { sendOverdueNotification } from "@/app/actions/rentals";

type OverdueItem = {
  id: string;
  user_id: string;
  book_id: string;
  book: { title: string; barcode: string };
  user: { name: string; dong_ho: string; phone_number: string };
  rented_at: string;
  due_date: string;
  overdue_days: number;
  notified_7day: boolean;
  notified_30day: boolean;
};

export default function OverduePage() {
  const router = useRouter();
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);

  function fetchData() {
    startTransition(async () => {
      const data = await getOverdueList();
      setItems(data as OverdueItem[]);
    });
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSendNotification(rentalId: string, type: '7day' | '30day') {
    setSendingId(`${rentalId}-${type}`);
    const result = await sendOverdueNotification(rentalId, type);
    setSendingId(null);
    if (result.success) {
      fetchData();
    } else {
      alert(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
        <AlertTriangle className="size-6 text-destructive" />
        연체 내역
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            연체 도서 목록
            {items.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {items.length}건
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              연체 도서가 없습니다
            </p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>대출자</TableHead>
                      <TableHead>동/호수</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>대출일</TableHead>
                      <TableHead>반납 예정일</TableHead>
                      <TableHead>연체일수</TableHead>
                      <TableHead>알림</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell
                          className="font-medium max-w-[200px] truncate text-primary cursor-pointer hover:underline"
                          onClick={() => router.push(`/admin/books/${item.book_id}`)}
                        >
                          {item.book.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {item.book.barcode}
                        </TableCell>
                        <TableCell
                          className="text-primary cursor-pointer hover:underline"
                          onClick={() => router.push(`/admin/residents/${item.user_id}`)}
                        >
                          {item.user.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.user.dong_ho}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.user.phone_number}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.rented_at}
                        </TableCell>
                        <TableCell className="text-destructive text-xs font-medium">
                          {item.due_date}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.overdue_days >= 30 ? "destructive" : "secondary"}
                          >
                            {item.overdue_days}일
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 items-center">
                            {item.notified_7day ? (
                              <Badge variant="outline" className="text-[10px]">7일 ✓</Badge>
                            ) : item.overdue_days >= 7 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2"
                                disabled={sendingId === `${item.id}-7day`}
                                onClick={() => handleSendNotification(item.id, '7day')}
                              >
                                {sendingId === `${item.id}-7day` ? <Loader2 className="size-3 animate-spin" /> : <><Send className="size-3 mr-1" />7일</>}
                              </Button>
                            ) : null}
                            {item.notified_30day ? (
                              <Badge variant="outline" className="text-[10px]">30일 ✓</Badge>
                            ) : item.overdue_days >= 30 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2"
                                disabled={sendingId === `${item.id}-30day`}
                                onClick={() => handleSendNotification(item.id, '30day')}
                              >
                                {sendingId === `${item.id}-30day` ? <Loader2 className="size-3 animate-spin" /> : <><Send className="size-3 mr-1" />30일</>}
                              </Button>
                            ) : null}
                            {!item.notified_7day && !item.notified_30day && item.overdue_days < 7 && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.book.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.book.barcode}</p>
                      </div>
                      <Badge
                        variant={item.overdue_days >= 30 ? "destructive" : "secondary"}
                        className="shrink-0"
                      >
                        {item.overdue_days}일 연체
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>대출자: <span className="text-foreground cursor-pointer text-primary" onClick={() => router.push(`/admin/residents/${item.user_id}`)}>{item.user.name}</span> ({item.user.dong_ho})</p>
                      <p>연락처: {item.user.phone_number}</p>
                      <p>반납 예정: <span className="text-destructive font-medium">{item.due_date}</span></p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {item.notified_7day ? (
                        <Badge variant="outline" className="text-[10px]">7일 알림 ✓</Badge>
                      ) : item.overdue_days >= 7 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          disabled={sendingId === `${item.id}-7day`}
                          onClick={() => handleSendNotification(item.id, '7day')}
                        >
                          {sendingId === `${item.id}-7day` ? <Loader2 className="size-3 animate-spin" /> : <><Send className="size-3 mr-1" />7일 알림</>}
                        </Button>
                      ) : null}
                      {item.notified_30day ? (
                        <Badge variant="outline" className="text-[10px]">30일 알림 ✓</Badge>
                      ) : item.overdue_days >= 30 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          disabled={sendingId === `${item.id}-30day`}
                          onClick={() => handleSendNotification(item.id, '30day')}
                        >
                          {sendingId === `${item.id}-30day` ? <Loader2 className="size-3 animate-spin" /> : <><Send className="size-3 mr-1" />30일 알림</>}
                        </Button>
                      ) : null}
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
