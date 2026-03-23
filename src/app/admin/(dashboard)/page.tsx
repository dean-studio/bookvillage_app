"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Search,
  ChevronLeft,
  ChevronRight,
  Library,
  Sparkles,
  Candy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getDashboardStats, getOverdueList } from "@/app/actions/stats";
import { getBooks, getNewBooks } from "@/app/actions/books";
import { getJellyRanking } from "@/app/actions/jelly";
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
  const router = useRouter();
  const [period, setPeriod] = useState("month");
  const [stats, setStats] = useState<DashboardData>(null);
  const [overdue, setOverdue] = useState<OverdueData>([]);
  const [isPending, startTransition] = useTransition();

  // Jelly ranking
  type JellyRankItem = { user_id: string; name: string; dong_ho: string; balance: number; total_earned: number };
  const [jellyRanking, setJellyRanking] = useState<JellyRankItem[]>([]);

  // New books state
  type NewBookItem = { id: string; barcode: string; title: string; author: string; cover_image: string | null; location_group: string; location_detail: string; is_available: boolean; created_at: string; featured_until: string | null };
  const [newBooks, setNewBooks] = useState<NewBookItem[]>([]);
  const [isLoadingNewBooks, startLoadNewBooks] = useTransition();

  // Book list state
  type BookItem = { id: string; barcode: string; title: string; author: string; location_group: string; location_detail: string; is_available: boolean };
  const [bookSearch, setBookSearch] = useState("");
  const [debouncedBookSearch, setDebouncedBookSearch] = useState("");
  const [bookList, setBookList] = useState<BookItem[]>([]);
  const [bookPage, setBookPage] = useState(1);
  const [bookTotalPages, setBookTotalPages] = useState(1);
  const [bookTotalCount, setBookTotalCount] = useState(0);
  const [isLoadingBooks, startLoadBooks] = useTransition();

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

  useEffect(() => {
    startLoadNewBooks(async () => {
      const [newBooksData, jellyData] = await Promise.all([
        getNewBooks(),
        getJellyRanking(),
      ]);
      setNewBooks(newBooksData as NewBookItem[]);
      setJellyRanking(jellyData as JellyRankItem[]);
    });
  }, []);

  // Book list: debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBookSearch(bookSearch);
      setBookPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [bookSearch]);

  const fetchBookList = useCallback(() => {
    startLoadBooks(async () => {
      const result = await getBooks({
        q: debouncedBookSearch || undefined,
        page: bookPage,
        limit: 50,
      });
      setBookList(result.books as BookItem[]);
      setBookTotalPages(result.totalPages);
      setBookTotalCount(result.totalCount);
    });
  }, [debouncedBookSearch, bookPage]);

  useEffect(() => {
    fetchBookList();
  }, [fetchBookList]);

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
              <TabsTrigger value="jelly" className="gap-1.5">
                <Candy className="size-4" />
                젤리 랭킹
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
                          <TableRow
                            key={i}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/admin/residents/${reader.user_id}`)}
                          >
                            <TableCell>{getRankBadge(i + 1)}</TableCell>
                            <TableCell className="font-medium text-primary">
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
                          <TableRow
                            key={i}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/admin/books/${book.book_id}`)}
                          >
                            <TableCell>{getRankBadge(i + 1)}</TableCell>
                            <TableCell className="font-medium text-primary">
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
                          <TableRow
                            key={i}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/admin/residents/${reviewer.user_id}`)}
                          >
                            <TableCell>{getRankBadge(i + 1)}</TableCell>
                            <TableCell className="font-medium text-primary">
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

            <TabsContent value="jelly">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    젤리 랭킹 TOP 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {jellyRanking.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      젤리 적립 기록이 없습니다.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">순위</TableHead>
                          <TableHead>이름</TableHead>
                          <TableHead className="hidden sm:table-cell">동/호수</TableHead>
                          <TableHead className="text-right">잔액</TableHead>
                          <TableHead className="text-right">총 획득</TableHead>
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
                            <TableCell className="hidden sm:table-cell text-muted-foreground">{item.dong_ho}</TableCell>
                            <TableCell className="text-right font-semibold text-yellow-600">{item.balance}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{item.total_earned}</TableCell>
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
                          <div
                            className="font-medium text-primary cursor-pointer hover:underline"
                            onClick={() => router.push(`/admin/residents/${item.user_id}`)}
                          >
                            {item.user.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.user.dong_ho}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-primary cursor-pointer hover:underline"
                          onClick={() => router.push(`/admin/books/${item.book_id}`)}
                        >
                          {item.book.title}
                        </TableCell>
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

          {/* 신작 도서 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-yellow-500" />
                신작 도서
                {newBooks.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({newBooks.length}권)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingNewBooks && newBooks.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : newBooks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  신작 도서가 없습니다
                </p>
              ) : (
                <div className="overflow-x-auto flex gap-3 pb-2">
                  {newBooks.map((b) => (
                    <div
                      key={b.id}
                      className="shrink-0 w-[140px] cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => router.push(`/admin/books/${b.id}`)}
                    >
                      {b.cover_image ? (
                        <img
                          src={b.cover_image}
                          alt={b.title}
                          className="w-full h-[190px] object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-[190px] bg-muted rounded flex items-center justify-center">
                          <BookOpen className="size-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-sm font-medium mt-1.5 line-clamp-2 leading-tight">{b.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant={b.is_available ? "default" : "secondary"} className="text-[10px]">
                          {b.is_available ? "가능" : "대출 중"}
                        </Badge>
                        {b.featured_until && (
                          <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                            수동
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 전체 도서 목록 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Library className="size-4" />
                  전체 도서 목록
                  {bookTotalCount > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({bookTotalCount}권)
                    </span>
                  )}
                </CardTitle>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="제목 또는 저자 검색..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBooks && bookList.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : bookList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {debouncedBookSearch ? "검색 결과가 없습니다" : "등록된 도서가 없습니다"}
                </p>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>바코드</TableHead>
                          <TableHead>제목</TableHead>
                          <TableHead>저자</TableHead>
                          <TableHead>서가 위치</TableHead>
                          <TableHead className="text-right">상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookList.map((b) => (
                          <TableRow
                            key={b.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/admin/books/${b.id}`)}
                          >
                            <TableCell className="font-mono text-xs">{b.barcode}</TableCell>
                            <TableCell className="font-medium">{b.title}</TableCell>
                            <TableCell className="text-muted-foreground">{b.author}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {b.location_group}{b.location_detail ? ` > ${b.location_detail}` : ""}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={b.is_available ? "default" : "secondary"}>
                                {b.is_available ? "대출 가능" : "대출 중"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {bookList.map((b) => (
                      <div
                        key={b.id}
                        className="border rounded-lg p-3 space-y-1 cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/admin/books/${b.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{b.title}</p>
                          <Badge variant={b.is_available ? "default" : "secondary"} className="shrink-0 text-xs">
                            {b.is_available ? "가능" : "대출 중"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{b.author}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-mono">{b.barcode}</span>
                          <span className="text-xs text-muted-foreground">
                            {b.location_group}{b.location_detail ? ` > ${b.location_detail}` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 페이지네이션 */}
                  {bookTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookPage((p) => Math.max(1, p - 1))}
                        disabled={bookPage <= 1}
                      >
                        <ChevronLeft className="size-4" />
                        이전
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {bookPage} / {bookTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookPage((p) => Math.min(bookTotalPages, p + 1))}
                        disabled={bookPage >= bookTotalPages}
                      >
                        다음
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
