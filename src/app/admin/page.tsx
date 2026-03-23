"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Users,
  TrendingUp,
  Clock,
  Trophy,
  Star,
  AlertTriangle,
  Loader2,
  PenLine,
} from "lucide-react";
import { getDashboardStats, getOverdueList } from "@/app/actions/stats";

function getDateRange(period: string) {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: string;

  switch (period) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      start = d.toISOString().split("T")[0];
      break;
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1).toISOString().split("T")[0];
      break;
    }
    case "year":
      start = `${now.getFullYear()}-01-01`;
      break;
    default: // month
      start = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
  }
  return { start, end };
}

type DashboardData = Awaited<ReturnType<typeof getDashboardStats>>;
type OverdueData = Awaited<ReturnType<typeof getOverdueList>>;

function getRankBadge(rank: number) {
  if (rank === 1)
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">1위</Badge>;
  if (rank === 2)
    return <Badge className="bg-gray-400 hover:bg-gray-500">2위</Badge>;
  if (rank === 3)
    return <Badge className="bg-amber-700 hover:bg-amber-800">3위</Badge>;
  return <Badge variant="outline">{rank}위</Badge>;
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState("month");
  const [stats, setStats] = useState<DashboardData>(null);
  const [overdue, setOverdue] = useState<OverdueData>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const { start, end } = getDateRange(period);
      const [statsData, overdueData] = await Promise.all([
        getDashboardStats(start, end),
        getOverdueList(),
      ]);
      setStats(statsData);
      setOverdue(overdueData);
    });
  }, [period]);

  const periodLabel =
    period === "week"
      ? "이번 주"
      : period === "month"
        ? "이번 달"
        : period === "quarter"
          ? "이번 분기"
          : "올해";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">이번 주</SelectItem>
            <SelectItem value="month">이번 달</SelectItem>
            <SelectItem value="quarter">이번 분기</SelectItem>
            <SelectItem value="year">올해</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending && !stats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {periodLabel} 대출
                </CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.summary.total_rentals ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  반납 {stats?.summary.total_returns ?? 0}건
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">대출 중</CardTitle>
                <BookOpen className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.summary.active_rentals ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">권 대출 중</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">연체</CardTitle>
                <Clock className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {stats?.summary.overdue_count ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">건 연체 중</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">신규 가입</CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.summary.new_members ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {periodLabel} 가입
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 랭킹 탭 */}
          <Tabs defaultValue="readers">
            <TabsList>
              <TabsTrigger value="readers" className="gap-1.5">
                <Trophy className="size-4" />
                다독왕
              </TabsTrigger>
              <TabsTrigger value="books" className="gap-1.5">
                <Star className="size-4" />
                인기 도서
              </TabsTrigger>
              <TabsTrigger value="reviewers" className="gap-1.5">
                <PenLine className="size-4" />
                독서록 작성자
              </TabsTrigger>
            </TabsList>

            <TabsContent value="readers">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {periodLabel} 다독왕 TOP 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.top_readers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      해당 기간에 대출 기록이 없습니다.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">순위</TableHead>
                          <TableHead>이름</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            동/호수
                          </TableHead>
                          <TableHead className="text-right">대출 수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats?.top_readers.map((reader, i) => (
                          <TableRow key={i}>
                            <TableCell>{getRankBadge(i + 1)}</TableCell>
                            <TableCell className="font-medium">
                              {reader.user.name}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {reader.user.dong_ho}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {reader.rental_count}권
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="books">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {periodLabel} 인기 도서 TOP 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.popular_books.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      해당 기간에 대출 기록이 없습니다.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">순위</TableHead>
                          <TableHead>도서명</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            저자
                          </TableHead>
                          <TableHead className="text-right">대출 수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats?.popular_books.map((book, i) => (
                          <TableRow key={i}>
                            <TableCell>{getRankBadge(i + 1)}</TableCell>
                            <TableCell className="font-medium">
                              {book.book.title}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {book.book.author}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {book.rental_count}회
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviewers">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {periodLabel} 우수 독서록 작성자 TOP 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.top_reviewers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      해당 기간에 독서록이 없습니다.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">순위</TableHead>
                          <TableHead>이름</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            동/호수
                          </TableHead>
                          <TableHead className="text-right">독서록 수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats?.top_reviewers.map((reviewer, i) => (
                          <TableRow key={i}>
                            <TableCell>{getRankBadge(i + 1)}</TableCell>
                            <TableCell className="font-medium">
                              {reviewer.user.name}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {reviewer.user.dong_ho}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {reviewer.report_count}편
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 연체 현황 */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <CardTitle className="text-base">
                연체 현황 ({overdue.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  현재 연체 도서가 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>주민</TableHead>
                      <TableHead>도서명</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        반납 기한
                      </TableHead>
                      <TableHead className="text-right">연체일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.user.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.user.dong_ho}
                          </div>
                        </TableCell>
                        <TableCell>{item.book.title}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {item.due_date}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">
                            {item.overdue_days}일
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
