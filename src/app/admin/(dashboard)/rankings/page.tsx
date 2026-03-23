"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Star,
  PenLine,
  Candy,
  Loader2,
  Search,
} from "lucide-react";
import { getDashboardStats } from "@/app/actions/stats";
import { getJellyRankingByPeriod } from "@/app/actions/jelly";

type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardStats>>>;
type JellyRankItem = Awaited<ReturnType<typeof getJellyRankingByPeriod>>[number];

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function getRankBadge(rank: number) {
  if (rank === 1)
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">1위</Badge>;
  if (rank === 2)
    return <Badge className="bg-gray-400 hover:bg-gray-500">2위</Badge>;
  if (rank === 3)
    return <Badge className="bg-amber-700 hover:bg-amber-800">3위</Badge>;
  return <Badge variant="outline">{rank}위</Badge>;
}

export default function AdminRankingsPage() {
  const router = useRouter();
  const defaults = getDefaultRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [jellyRanking, setJellyRanking] = useState<JellyRankItem[]>([]);
  const [isPending, startTransition] = useTransition();

  function fetchData(start: string, end: string) {
    startTransition(async () => {
      const [statsData, jellyData] = await Promise.all([
        getDashboardStats(start, end),
        getJellyRankingByPeriod(start, end),
      ]);
      if (statsData) setStats(statsData);
      setJellyRanking(jellyData);
    });
  }

  useEffect(() => {
    fetchData(startDate, endDate);
  }, []);

  function handleSearch() {
    if (!startDate || !endDate) return;
    fetchData(startDate, endDate);
  }

  const periodLabel = `${startDate} ~ ${endDate}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">랭킹</h1>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 space-y-1.5 w-full sm:w-auto">
              <label className="text-sm font-medium">시작일</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1.5 w-full sm:w-auto">
              <label className="text-sm font-medium">종료일</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={handleSearch} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Search className="size-4 mr-1.5" />
              )}
              조회
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            {[
              { label: "최근 1주", days: 7 },
              { label: "최근 1개월", days: 30 },
              { label: "최근 3개월", days: 90 },
              { label: "최근 6개월", days: 180 },
              { label: "올해", days: -1 },
            ].map(({ label, days }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const end = new Date();
                  let start: Date;
                  if (days === -1) {
                    start = new Date(end.getFullYear(), 0, 1);
                  } else {
                    start = new Date();
                    start.setDate(start.getDate() - days);
                  }
                  const s = start.toISOString().split("T")[0];
                  const e = end.toISOString().split("T")[0];
                  setStartDate(s);
                  setEndDate(e);
                  fetchData(s, e);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isPending && !stats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="readers">
          <Card>
            <TabsList className="w-full grid grid-cols-4 !h-auto p-1.5 bg-muted/50 rounded-b-none border-b">
              <TabsTrigger value="readers" className="gap-1.5 py-2.5 text-sm">
                <Trophy className="size-4" />
                <span className="hidden sm:inline">다독왕</span>
                <span className="sm:hidden">다독</span>
              </TabsTrigger>
              <TabsTrigger value="books" className="gap-1.5 py-2.5 text-sm">
                <Star className="size-4" />
                <span className="hidden sm:inline">인기 도서</span>
                <span className="sm:hidden">인기</span>
              </TabsTrigger>
              <TabsTrigger value="reviewers" className="gap-1.5 py-2.5 text-sm">
                <PenLine className="size-4" />
                <span className="hidden sm:inline">독서록</span>
                <span className="sm:hidden">독서록</span>
              </TabsTrigger>
              <TabsTrigger value="jelly" className="gap-1.5 py-2.5 text-sm">
                <Candy className="size-4" />
                <span className="hidden sm:inline">젤리</span>
                <span className="sm:hidden">젤리</span>
              </TabsTrigger>
            </TabsList>

          {/* 다독왕 */}
          <TabsContent value="readers" className="mt-0">
              <CardContent className="pt-5">
                {!stats || stats.top_readers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    해당 기간에 대출 기록이 없습니다.
                  </p>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">순위</TableHead>
                            <TableHead>이름</TableHead>
                            <TableHead>동/호수</TableHead>
                            <TableHead className="text-right">대출 수</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.top_readers.map((reader, i) => (
                            <TableRow
                              key={reader.user_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/admin/residents/${reader.user_id}`)}
                            >
                              <TableCell>{getRankBadge(i + 1)}</TableCell>
                              <TableCell className="font-medium text-primary">{reader.user.name}</TableCell>
                              <TableCell className="text-muted-foreground">{reader.user.dong_ho}</TableCell>
                              <TableCell className="text-right font-semibold">{reader.rental_count}권</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {stats.top_readers.map((reader, i) => (
                        <div
                          key={reader.user_id}
                          className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/admin/residents/${reader.user_id}`)}
                        >
                          <div className="flex items-center gap-3">
                            {getRankBadge(i + 1)}
                            <div>
                              <p className="text-sm font-medium text-primary">{reader.user.name}</p>
                              <p className="text-xs text-muted-foreground">{reader.user.dong_ho}</p>
                            </div>
                          </div>
                          <span className="font-semibold">{reader.rental_count}권</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
          </TabsContent>

          {/* 인기 도서 */}
          <TabsContent value="books" className="mt-0">
              <CardContent className="pt-5">
                {!stats || stats.popular_books.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    해당 기간에 대출 기록이 없습니다.
                  </p>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">순위</TableHead>
                            <TableHead>도서명</TableHead>
                            <TableHead>저자</TableHead>
                            <TableHead className="text-right">대출 수</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.popular_books.map((book, i) => (
                            <TableRow
                              key={book.book_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/admin/books/${book.book_id}`)}
                            >
                              <TableCell>{getRankBadge(i + 1)}</TableCell>
                              <TableCell className="font-medium text-primary">{book.book.title}</TableCell>
                              <TableCell className="text-muted-foreground">{book.book.author}</TableCell>
                              <TableCell className="text-right font-semibold">{book.rental_count}회</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {stats.popular_books.map((book, i) => (
                        <div
                          key={book.book_id}
                          className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/admin/books/${book.book_id}`)}
                        >
                          <div className="flex items-center gap-3">
                            {getRankBadge(i + 1)}
                            <div>
                              <p className="text-sm font-medium text-primary">{book.book.title}</p>
                              <p className="text-xs text-muted-foreground">{book.book.author}</p>
                            </div>
                          </div>
                          <span className="font-semibold">{book.rental_count}회</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
          </TabsContent>

          {/* 독서록 작성자 */}
          <TabsContent value="reviewers" className="mt-0">
              <CardContent className="pt-5">
                {!stats || stats.top_reviewers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    해당 기간에 독서록이 없습니다.
                  </p>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">순위</TableHead>
                            <TableHead>이름</TableHead>
                            <TableHead>동/호수</TableHead>
                            <TableHead className="text-right">독서록 수</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.top_reviewers.map((reviewer, i) => (
                            <TableRow
                              key={reviewer.user_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/admin/residents/${reviewer.user_id}`)}
                            >
                              <TableCell>{getRankBadge(i + 1)}</TableCell>
                              <TableCell className="font-medium text-primary">{reviewer.user.name}</TableCell>
                              <TableCell className="text-muted-foreground">{reviewer.user.dong_ho}</TableCell>
                              <TableCell className="text-right font-semibold">{reviewer.report_count}편</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {stats.top_reviewers.map((reviewer, i) => (
                        <div
                          key={reviewer.user_id}
                          className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/admin/residents/${reviewer.user_id}`)}
                        >
                          <div className="flex items-center gap-3">
                            {getRankBadge(i + 1)}
                            <div>
                              <p className="text-sm font-medium text-primary">{reviewer.user.name}</p>
                              <p className="text-xs text-muted-foreground">{reviewer.user.dong_ho}</p>
                            </div>
                          </div>
                          <span className="font-semibold">{reviewer.report_count}편</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
          </TabsContent>

          {/* 젤리 랭킹 */}
          <TabsContent value="jelly" className="mt-0">
              <CardContent className="pt-5">
                {jellyRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    해당 기간에 젤리 적립 기록이 없습니다.
                  </p>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">순위</TableHead>
                            <TableHead>이름</TableHead>
                            <TableHead>동/호수</TableHead>
                            <TableHead className="text-right">획득 젤리</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jellyRanking.map((item, i) => (
                            <TableRow
                              key={item.user_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/admin/residents/${item.user_id}`)}
                            >
                              <TableCell>{getRankBadge(i + 1)}</TableCell>
                              <TableCell className="font-medium text-primary">{item.name}</TableCell>
                              <TableCell className="text-muted-foreground">{item.dong_ho}</TableCell>
                              <TableCell className="text-right font-semibold text-yellow-600">{item.earned}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {jellyRanking.map((item, i) => (
                        <div
                          key={item.user_id}
                          className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/admin/residents/${item.user_id}`)}
                        >
                          <div className="flex items-center gap-3">
                            {getRankBadge(i + 1)}
                            <div>
                              <p className="text-sm font-medium text-primary">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.dong_ho}</p>
                            </div>
                          </div>
                          <span className="font-semibold text-yellow-600">{item.earned} 젤리</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
          </TabsContent>
          </Card>
        </Tabs>
      )}
    </div>
  );
}
