"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { getBooks } from "@/app/actions/books";
import { createQuiz } from "@/app/actions/quizzes";
import { getOverdueList } from "@/app/actions/stats";

type BookItem = { id: string; title: string; author: string; barcode: string };
type OverdueItem = Awaited<ReturnType<typeof getOverdueList>>[number];

export default function AdminManagePage() {
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

  const [isSearchingBooks, startSearchBooks] = useTransition();
  const [isCreatingQuiz, startCreateQuiz] = useTransition();
  const [isLoadingOverdue, startLoadOverdue] = useTransition();

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">관리</h1>

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

                  {/* 도서 선택 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">도서 선택</label>
                    {selectedBook ? (
                      <div className="flex items-center justify-between p-2 rounded border bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">
                            {selectedBook.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedBook.author}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBook(null)}
                        >
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
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleBookSearch()
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBookSearch}
                            disabled={isSearchingBooks}
                          >
                            {isSearchingBooks ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Search className="size-4" />
                            )}
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
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {b.author}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 질문 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">질문</label>
                    <Input
                      placeholder="독서 퀴즈 질문을 입력하세요"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                  </div>

                  {/* 선택지 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      선택지 (4개)
                    </label>
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

                  {/* 정답 */}
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

                  <Button
                    className="w-full"
                    onClick={handleCreateQuiz}
                    disabled={isCreatingQuiz}
                  >
                    {isCreatingQuiz ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="size-4 mr-2" />
                    )}
                    퀴즈 등록
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoadOverdue}
              disabled={isLoadingOverdue}
            >
              {isLoadingOverdue ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Bell className="size-4 mr-2" />
              )}
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
                      <div className="text-xs text-muted-foreground">
                        {item.user.dong_ho}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.book.title}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">
                        {item.overdue_days}일
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.notified_7day && (
                        <Badge variant="secondary" className="text-xs">
                          7일
                        </Badge>
                      )}
                      {item.notified_30day && (
                        <Badge variant="secondary" className="text-xs">
                          30일
                        </Badge>
                      )}
                      {!item.notified_7day && !item.notified_30day && (
                        <span className="text-xs text-muted-foreground">
                          미발송
                        </span>
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
