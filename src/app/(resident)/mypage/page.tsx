"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  FileText,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Loader2,
} from "lucide-react";
import { signOut, getCurrentUser } from "@/app/actions/auth";
import { getMyRentals } from "@/app/actions/rentals";
import { getQuizzesByBook, submitQuizAnswer } from "@/app/actions/quizzes";
import { createBookReport } from "@/app/actions/book-reports";

type ActiveRental = {
  id: string;
  book: { id: string; title: string; author: string; cover_image: string | null };
  rented_at: string;
  due_date: string;
  is_overdue: boolean;
  remaining_days: number;
};

type PastRental = {
  id: string;
  book: { id: string; title: string; author: string; cover_image: string | null };
  rented_at: string;
  returned_at: string;
  has_quiz: boolean;
  has_report: boolean;
};

type QuizItem = {
  id: string;
  question: string;
  options: string[];
  is_solved: boolean;
};

export default function MyPage() {
  const [tab, setTab] = useState<"active" | "returned">("active");
  const [userName, setUserName] = useState("");
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [pastRentals, setPastRentals] = useState<PastRental[]>([]);
  const [isLoading, startTransition] = useTransition();

  // Quiz state
  const [quizBookId, setQuizBookId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<{ is_correct: boolean; correct_answer: number } | null>(null);
  const [isQuizLoading, startQuizTransition] = useTransition();

  // Report state
  const [reportBookId, setReportBookId] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportRating, setReportRating] = useState(0);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isReportLoading, startReportTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [user, rentals] = await Promise.all([
        getCurrentUser(),
        getMyRentals(),
      ]);
      if (user) setUserName(user.name);
      setActiveRentals(rentals.active_rentals as ActiveRental[]);
      setPastRentals(rentals.past_rentals as PastRental[]);
    });
  }, []);

  function openQuiz(bookId: string) {
    setQuizBookId(bookId);
    setQuizAnswer(null);
    setQuizResult(null);
    setCurrentQuizIdx(0);
    startQuizTransition(async () => {
      const data = await getQuizzesByBook(bookId);
      setQuizzes(data as QuizItem[]);
    });
  }

  function handleQuizSubmit(quizId: string, selectedAnswer: number) {
    setQuizAnswer(selectedAnswer);
    startQuizTransition(async () => {
      const formData = new FormData();
      formData.set("quiz_id", quizId);
      formData.set("selected_answer", String(selectedAnswer));
      const result = await submitQuizAnswer(formData);
      if (result.success && result.data) {
        setQuizResult(result.data);
      } else {
        setQuizResult({ is_correct: false, correct_answer: -1 });
      }
    });
  }

  function handleReportSubmit() {
    if (!reportBookId || reportRating === 0 || reportText.trim().length < 10) return;
    setReportError(null);
    startReportTransition(async () => {
      const formData = new FormData();
      formData.set("book_id", reportBookId);
      formData.set("rating", String(reportRating));
      formData.set("review", reportText);
      const result = await createBookReport(formData);
      if (result.success) {
        setReportBookId(null);
        // Refresh rentals to update has_report
        const rentals = await getMyRentals();
        setPastRentals(rentals.past_rentals as PastRental[]);
      } else {
        setReportError(result.error ?? "독서록 작성에 실패했습니다.");
      }
    });
  }

  const currentList = tab === "active" ? activeRentals : pastRentals;
  const currentQuiz = quizzes[currentQuizIdx];

  return (
    <div className="flex flex-1 flex-col">
      {/* 헤더 */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">내 서재</h1>
            <p className="text-xl text-muted-foreground mt-1">
              {userName ? `${userName}님의 독서 활동` : "독서 활동"}
            </p>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="lg" className="text-lg gap-2">
              <LogOut className="size-5" />
              로그아웃
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 space-y-6">
        {/* 탭 */}
        <div className="flex gap-2">
          <Button
            variant={tab === "active" ? "default" : "outline"}
            className="h-12 text-lg px-5 flex-1"
            onClick={() => setTab("active")}
          >
            <Clock className="size-5 mr-2" />
            대출 중 ({activeRentals.length})
          </Button>
          <Button
            variant={tab === "returned" ? "default" : "outline"}
            className="h-12 text-lg px-5 flex-1"
            onClick={() => setTab("returned")}
          >
            <CheckCircle2 className="size-5 mr-2" />
            반납 완료 ({pastRentals.length})
          </Button>
        </div>

        {/* 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : currentList.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-xl text-muted-foreground text-center">
                {tab === "active"
                  ? "대출 중인 도서가 없습니다"
                  : "반납 이력이 없습니다"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tab === "active"
              ? (activeRentals as ActiveRental[]).map((rental) => (
                  <Card key={rental.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xl font-semibold truncate">
                            {rental.book.title}
                          </p>
                          <p className="text-lg text-muted-foreground">
                            {rental.book.author}
                          </p>
                        </div>
                        {rental.is_overdue ? (
                          <Badge
                            variant="destructive"
                            className="text-base px-3 py-1 shrink-0"
                          >
                            <AlertTriangle className="size-4 mr-1" />
                            {Math.abs(rental.remaining_days)}일 연체
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-base px-3 py-1 shrink-0"
                          >
                            D-{rental.remaining_days}
                          </Badge>
                        )}
                      </div>
                      <div className="text-base text-muted-foreground space-y-0.5">
                        <p>대출일: {rental.rented_at}</p>
                        <p>
                          반납 예정:{" "}
                          <span
                            className={
                              rental.is_overdue
                                ? "text-destructive font-semibold"
                                : ""
                            }
                          >
                            {rental.due_date}
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              : (pastRentals as PastRental[]).map((rental) => (
                  <Card key={rental.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xl font-semibold truncate">
                            {rental.book.title}
                          </p>
                          <p className="text-lg text-muted-foreground">
                            {rental.book.author}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-base px-3 py-1 shrink-0"
                        >
                          반납 완료
                        </Badge>
                      </div>
                      <div className="text-base text-muted-foreground">
                        <p>반납일: {rental.returned_at}</p>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <Button
                          variant="outline"
                          className="h-14 flex-1 text-lg gap-2"
                          onClick={() => openQuiz(rental.book.id)}
                          disabled={!rental.has_quiz}
                        >
                          <HelpCircle className="size-5" />
                          {rental.has_quiz ? "퀴즈 풀기" : "퀴즈 없음"}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-14 flex-1 text-lg gap-2"
                          onClick={() => {
                            setReportBookId(rental.book.id);
                            setReportText("");
                            setReportRating(0);
                            setReportError(null);
                          }}
                          disabled={rental.has_report}
                        >
                          <FileText className="size-5" />
                          {rental.has_report ? "작성 완료" : "독서록 쓰기"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        )}
      </main>

      {/* 퀴즈 모달 */}
      <Dialog
        open={!!quizBookId}
        onOpenChange={(open) => {
          if (!open) {
            setQuizBookId(null);
            setQuizzes([]);
            setQuizAnswer(null);
            setQuizResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">독서 퀴즈</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isQuizLoading && quizzes.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : quizzes.length === 0 ? (
              <p className="text-lg text-muted-foreground text-center py-8">
                등록된 퀴즈가 없습니다
              </p>
            ) : currentQuiz ? (
              <>
                {quizzes.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    {currentQuizIdx + 1} / {quizzes.length}
                  </p>
                )}
                <p className="text-lg font-medium">{currentQuiz.question}</p>
                {currentQuiz.is_solved ? (
                  <p className="text-lg text-muted-foreground text-center py-4">
                    이미 풀었던 퀴즈입니다
                  </p>
                ) : (
                  <div className="space-y-2">
                    {currentQuiz.options.map((option, i) => (
                      <Button
                        key={i}
                        variant={
                          quizAnswer === null
                            ? "outline"
                            : quizResult
                              ? i === quizResult.correct_answer
                                ? "default"
                                : quizAnswer === i
                                  ? "destructive"
                                  : "outline"
                              : quizAnswer === i
                                ? "secondary"
                                : "outline"
                        }
                        className="w-full h-14 text-lg justify-start px-4"
                        onClick={() => handleQuizSubmit(currentQuiz.id, i)}
                        disabled={quizAnswer !== null}
                      >
                        {i + 1}. {option}
                      </Button>
                    ))}
                  </div>
                )}
                {quizResult && (
                  <p
                    className={`text-lg font-semibold text-center ${
                      quizResult.is_correct ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {quizResult.is_correct
                      ? "정답입니다!"
                      : "오답입니다."}
                  </p>
                )}
                {quizzes.length > 1 && (quizResult || currentQuiz.is_solved) && currentQuizIdx < quizzes.length - 1 && (
                  <Button
                    variant="outline"
                    className="w-full h-12 text-lg"
                    onClick={() => {
                      setCurrentQuizIdx((i) => i + 1);
                      setQuizAnswer(null);
                      setQuizResult(null);
                    }}
                  >
                    다음 문제
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* 독서록 모달 */}
      <Dialog
        open={!!reportBookId}
        onOpenChange={(open) => {
          if (!open) setReportBookId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">독서록 쓰기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {reportError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-center">
                <p className="text-base text-destructive">{reportError}</p>
              </div>
            )}
            <div>
              <label className="text-lg font-medium mb-2 block">별점</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant={reportRating >= star ? "default" : "outline"}
                    className="h-14 w-14 text-2xl"
                    onClick={() => setReportRating(star)}
                  >
                    {reportRating >= star ? "★" : "☆"}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-lg font-medium mb-2 block">감상문</label>
              <textarea
                placeholder="이 책에 대한 감상을 자유롭게 적어주세요 (10자 이상)"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-4 py-3 text-lg ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {reportText.length}자 / 최소 10자
              </p>
            </div>
            <Button
              className="w-full h-14 text-xl"
              disabled={
                reportRating === 0 ||
                reportText.trim().length < 10 ||
                isReportLoading
              }
              onClick={handleReportSubmit}
            >
              {isReportLoading ? (
                <Loader2 className="size-5 animate-spin mr-2" />
              ) : null}
              등록하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
