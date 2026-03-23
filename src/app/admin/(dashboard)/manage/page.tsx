"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  Bell,
  Plus,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Trash2,
  Settings,
  Candy,
  Building2,
  Globe,
  ChevronRight,
} from "lucide-react";
import { getBooks, getBookDeletions } from "@/app/actions/books";
import { createQuiz } from "@/app/actions/quizzes";
import { getOverdueList } from "@/app/actions/stats";
import { getPendingAdmins, approveAdmin, rejectAdmin } from "@/app/actions/auth";

type BookItem = { id: string; title: string; author: string; barcode: string };
type OverdueItem = Awaited<ReturnType<typeof getOverdueList>>[number];
type PendingAdmin = { id: string; name: string; created_at: string };
type DeletionItem = { id: string; book_title: string; book_barcode: string; book_author: string | null; deleted_at: string; profiles: { name: string } | null };

const settingsMenu = [
  { href: "/admin/manage/site", icon: Building2, label: "사이트 기본정보", desc: "아파트명, 로고 이미지" },
  { href: "/admin/manage/og", icon: Globe, label: "OG 메타데이터", desc: "공유 시 표시 제목/설명/이미지" },
  { href: "/admin/manage/library", icon: Settings, label: "도서관 설정", desc: "대출 권수, 기간, 신작 기준" },
  { href: "/admin/manage/jelly", icon: Candy, label: "젤리 포인트 설정", desc: "활동별 젤리 지급량" },
];

export default function AdminManagePage() {
  const router = useRouter();

  // Quiz creation state
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [bookResults, setBookResults] = useState<BookItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState("");
  const [quizError, setQuizError] = useState("");
  const [quizSuccess, setQuizSuccess] = useState(false);

  // Overdue state
  const [overdueList, setOverdueList] = useState<OverdueItem[]>([]);
  const [overdueLoaded, setOverdueLoaded] = useState(false);

  // Admin approval state
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [adminsLoaded, setAdminsLoaded] = useState(false);

  // Deletion log state
  const [deletions, setDeletions] = useState<DeletionItem[]>([]);
  const [deletionsLoaded, setDeletionsLoaded] = useState(false);
  const [isLoadingDeletions, startLoadDeletions] = useTransition();

  const [isSearchingBooks, startSearchBooks] = useTransition();
  const [isCreatingQuiz, startCreateQuiz] = useTransition();
  const [isLoadingOverdue, startLoadOverdue] = useTransition();
  const [isLoadingAdmins, startLoadAdmins] = useTransition();
  const [isProcessingAdmin, startProcessAdmin] = useTransition();

  const handleBookSearch = () => {
    if (!bookSearch.trim()) return;
    startSearchBooks(async () => {
      const result = await getBooks({ q: bookSearch.trim(), limit: 5 });
      setBookResults(
        result.books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          barcode: b.barcode,
        }))
      );
    });
  };

  const handleCreateQuiz = () => {
    if (!selectedBook || !question.trim() || options.some((o) => !o.trim()) || !answer) {
      setQuizError("모든 항목을 입력해주세요.");
      return;
    }
    setQuizError("");
    startCreateQuiz(async () => {
      const formData = new FormData();
      formData.set("book_id", selectedBook.id);
      formData.set("question", question.trim());
      options.forEach((o) => formData.append("options", o.trim()));
      formData.set("answer", answer);

      const result = await createQuiz(formData);
      if (!result.success) {
        setQuizError(result.error || "퀴즈 등록에 실패했습니다.");
        return;
      }
      setQuizSuccess(true);
      setTimeout(() => {
        resetQuizForm();
        setQuizDialogOpen(false);
      }, 1500);
    });
  };

  const resetQuizForm = () => {
    setSelectedBook(null);
    setBookSearch("");
    setBookResults([]);
    setQuestion("");
    setOptions(["", "", "", ""]);
    setAnswer("");
    setQuizError("");
    setQuizSuccess(false);
  };

  const handleLoadOverdue = () => {
    startLoadOverdue(async () => {
      const data = await getOverdueList();
      setOverdueList(data);
      setOverdueLoaded(true);
    });
  };

  const handleLoadAdmins = () => {
    startLoadAdmins(async () => {
      const data = await getPendingAdmins();
      setPendingAdmins(data as PendingAdmin[]);
      setAdminsLoaded(true);
    });
  };

  const handleApproveAdmin = (adminId: string) => {
    startProcessAdmin(async () => {
      const result = await approveAdmin(adminId);
      if (result.success) {
        setPendingAdmins((prev) => prev.filter((a) => a.id !== adminId));
      }
    });
  };

  const handleRejectAdmin = (adminId: string) => {
    startProcessAdmin(async () => {
      const result = await rejectAdmin(adminId);
      if (result.success) {
        setPendingAdmins((prev) => prev.filter((a) => a.id !== adminId));
      }
    });
  };

  const handleLoadDeletions = () => {
    startLoadDeletions(async () => {
      const result = await getBookDeletions();
      setDeletions(result.deletions as DeletionItem[]);
      setDeletionsLoaded(true);
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">관리</h1>

      {/* 설정 메뉴 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {settingsMenu.map((item) => (
          <Card
            key={item.href}
            className="cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
            onClick={() => router.push(item.href)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <item.icon className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 퀴즈 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="size-4" />
            독서 퀴즈 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            도서별 독서 퀴즈를 등록하고 관리합니다.
          </p>
          <Dialog
            open={quizDialogOpen}
            onOpenChange={(open) => {
              setQuizDialogOpen(open);
              if (!open) resetQuizForm();
            }}
          >
            <DialogTrigger
              className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              <Plus className="size-4" />
              퀴즈 등록하기
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>독서 퀴즈 등록</DialogTitle>
              </DialogHeader>

              {quizSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="size-12 mx-auto text-green-600" />
                  <p className="font-semibold">퀴즈가 등록되었습니다!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quizError && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                      <AlertCircle className="size-4 shrink-0" />
                      {quizError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">도서 선택</label>
                    {selectedBook ? (
                      <div className="flex items-center justify-between p-2 rounded border bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{selectedBook.title}</p>
                          <p className="text-xs text-muted-foreground">{selectedBook.author}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
                          변경
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Input
                            placeholder="도서명 검색"
                            value={bookSearch}
                            onChange={(e) => setBookSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleBookSearch()}
                          />
                          <Button variant="outline" size="sm" onClick={handleBookSearch} disabled={isSearchingBooks}>
                            {isSearchingBooks ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                          </Button>
                        </div>
                        {bookResults.length > 0 && (
                          <div className="border rounded max-h-40 overflow-y-auto">
                            {bookResults.map((b) => (
                              <button
                                key={b.id}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                                onClick={() => {
                                  setSelectedBook(b);
                                  setBookResults([]);
                                }}
                              >
                                <span className="font-medium">{b.title}</span>
                                <span className="text-muted-foreground"> · {b.author}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">질문</label>
                    <Input
                      placeholder="독서 퀴즈 질문을 입력하세요"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">선택지 (4개)</label>
                    {options.map((opt, i) => (
                      <Input
                        key={i}
                        placeholder={`${i + 1}번 선택지`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[i] = e.target.value;
                          setOptions(newOpts);
                        }}
                      />
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">정답</label>
                    <Select value={answer} onValueChange={(v) => v && setAnswer(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="정답 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt, i) => (
                          <SelectItem key={i} value={String(i)} disabled={!opt.trim()}>
                            {i + 1}번: {opt || "(미입력)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" onClick={handleCreateQuiz} disabled={isCreatingQuiz}>
                    {isCreatingQuiz ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
                    퀴즈 등록
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* 관리자 승인 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            관리자 승인 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            관리자 가입 신청을 승인하거나 거절합니다.
          </p>

          {!adminsLoaded ? (
            <Button variant="outline" className="w-full" onClick={handleLoadAdmins} disabled={isLoadingAdmins}>
              {isLoadingAdmins ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ShieldCheck className="size-4 mr-2" />}
              승인 대기 목록 보기
            </Button>
          ) : pendingAdmins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              승인 대기 중인 관리자가 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(admin.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="default" onClick={() => handleApproveAdmin(admin.id)} disabled={isProcessingAdmin}>
                        <UserCheck className="size-3.5 mr-1" />
                        승인
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRejectAdmin(admin.id)} disabled={isProcessingAdmin}>
                        <UserX className="size-3.5 mr-1" />
                        거절
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 도서 삭제 내역 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="size-4" />
            도서 삭제 내역
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            삭제된 도서 기록을 확인합니다.
          </p>

          {!deletionsLoaded ? (
            <Button variant="outline" className="w-full" onClick={handleLoadDeletions} disabled={isLoadingDeletions}>
              {isLoadingDeletions ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
              삭제 내역 보기
            </Button>
          ) : deletions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              삭제 내역이 없습니다.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서명</TableHead>
                      <TableHead>저자</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>삭제자</TableHead>
                      <TableHead className="text-right">삭제일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.book_title}</TableCell>
                        <TableCell className="text-muted-foreground">{item.book_author || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{item.book_barcode}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.profiles?.name || "알 수 없음"}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {new Date(item.deleted_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-2">
                {deletions.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium">{item.book_title}</p>
                    <p className="text-xs text-muted-foreground">{item.book_author || "-"} · {item.book_barcode}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{item.profiles?.name || "알 수 없음"}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.deleted_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 연체 알림 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" />
            연체 알림 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            연체 도서 현황 확인 및 알림톡 발송을 관리합니다.
          </p>

          {!overdueLoaded ? (
            <Button variant="outline" className="w-full" onClick={handleLoadOverdue} disabled={isLoadingOverdue}>
              {isLoadingOverdue ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Bell className="size-4 mr-2" />}
              연체 현황 보기
            </Button>
          ) : overdueList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              현재 연체 도서가 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주민</TableHead>
                  <TableHead>도서명</TableHead>
                  <TableHead className="text-right">연체일</TableHead>
                  <TableHead className="text-right">알림</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.user.name}</div>
                      <div className="text-xs text-muted-foreground">{item.user.dong_ho}</div>
                    </TableCell>
                    <TableCell className="text-sm">{item.book.title}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{item.overdue_days}일</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.notified_7day && <Badge variant="secondary" className="text-xs">7일</Badge>}
                      {item.notified_30day && <Badge variant="secondary" className="text-xs">30일</Badge>}
                      {!item.notified_7day && !item.notified_30day && (
                        <span className="text-xs text-muted-foreground">미발송</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
