"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  Loader2,
  ChevronLeft,
  Candy,
  X,
  Sparkles,
} from "lucide-react";
import { getMyRentals } from "@/app/actions/rentals";
import { getQuizzesByBook, submitQuizAnswer } from "@/app/actions/quizzes";
import { createBookReport } from "@/app/actions/book-reports";

type PastRental = {
  id: string;
  book: { id: string; title: string; author: string; cover_image: string | null };
  rented_at: string;
  returned_at: string;
  has_quiz: boolean;
  has_report: boolean;
};

type QuizItem = { id: string; question: string; options: string[]; is_solved: boolean };

// 감상문 작성 가이드: 탭하면 질문이 입력창에 삽입돼 글쓰기를 도와준다
const REPORT_HINTS = [
  "가장 기억에 남는 장면은?",
  "주인공에게 하고 싶은 말은?",
  "누구에게 추천하고 싶나요?",
  "새롭게 알게 된 점은?",
];

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" });
}

export default function MyReturnedPage() {
  const router = useRouter();
  const { data: rentals = [], isLoading, refetch } = useQuery({
    queryKey: ["myReturned"],
    queryFn: async () => {
      const data = await getMyRentals();
      return data.past_rentals as PastRental[];
    },
  });

  // Quiz
  const [quizBookId, setQuizBookId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<{ is_correct: boolean; correct_answer: number } | null>(null);
  const [isQuizLoading, startQuizTransition] = useTransition();

  // Report (전용 풀스크린 에디터)
  const [reportTarget, setReportTarget] = useState<PastRental | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportRating, setReportRating] = useState(0);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [isReportLoading, startReportTransition] = useTransition();

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
      if (result.success && result.data) setQuizResult(result.data);
      else setQuizResult({ is_correct: false, correct_answer: -1 });
    });
  }

  function openReport(rental: PastRental) {
    setReportTarget(rental);
    setReportText("");
    setReportRating(0);
    setReportError(null);
  }

  function closeReport() {
    setReportTarget(null);
  }

  function insertHint(hint: string) {
    setReportText((prev) => {
      if (prev.includes(hint)) return prev;
      const sep = prev.trim().length === 0 ? "" : "\n\n";
      return `${prev}${sep}${hint}\n`;
    });
  }

  function handleReportSubmit() {
    if (!reportTarget) return;
    if (reportRating === 0 || reportText.trim().length < 10) return;
    setReportError(null);
    const bookId = reportTarget.book.id;
    startReportTransition(async () => {
      const formData = new FormData();
      formData.set("book_id", bookId);
      formData.set("rating", String(reportRating));
      formData.set("review", reportText);
      const result = await createBookReport(formData);
      if (result.success) {
        setReportSuccess(bookId);
        setReportTarget(null);
        setTimeout(() => setReportSuccess(null), 3000);
        refetch();
      } else {
        setReportError(result.error ?? "독서록 작성에 실패했습니다.");
      }
    });
  }

  const currentQuiz = quizzes[currentQuizIdx];
  const reportValid = reportRating > 0 && reportText.trim().length >= 10;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft className="size-[clamp(1.3rem,3vw,1.6rem)]" />
        </button>
        <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold">반납완료 도서</h1>
        <Badge variant="secondary" className="text-[clamp(0.85rem,1.8vw,1.05rem)]">
          {rentals.length}권
        </Badge>
      </header>

      <main className="flex-1 overflow-y-auto px-[3vw] py-[1.5vh] space-y-[1vh]">
        {isLoading && rentals.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : rentals.length === 0 ? (
          <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] text-muted-foreground text-center py-16">
            반납 이력이 없습니다
          </p>
        ) : (
          <>
            {reportSuccess && (
              <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400/50 px-4 py-3 flex items-center gap-2">
                <Candy className="size-[clamp(1.1rem,2.5vw,1.4rem)] text-yellow-600 shrink-0" />
                <p className="text-[clamp(0.95rem,2vw,1.2rem)] text-yellow-700 dark:text-yellow-400 font-medium">
                  독서록 작성 완료! <span className="font-bold">+10 젤리</span> 획득!
                </p>
              </div>
            )}
            {rentals.some((r) => !r.has_report) && !reportSuccess && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-2">
                <Candy className="size-[clamp(1rem,2.2vw,1.3rem)] text-yellow-500 shrink-0" />
                <p className="text-[clamp(0.85rem,1.8vw,1.05rem)] text-muted-foreground">
                  독서록을 쓰면 <span className="font-semibold text-yellow-600">+10 젤리</span>를 받을 수 있어요!
                </p>
              </div>
            )}
            {rentals.map((rental) => (
              <Card key={rental.id}>
                <CardContent className="p-[clamp(0.75rem,1.5vw,1.25rem)] space-y-[0.8vh]">
                  <div
                    className="flex gap-[clamp(0.6rem,1.5vw,1rem)] cursor-pointer"
                    onClick={() => router.push(`/books/${rental.book.id}`)}
                  >
                    {rental.book.cover_image ? (
                      <img src={rental.book.cover_image} alt={rental.book.title} className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-[clamp(3.5rem,8vw,5rem)] h-[clamp(5rem,11vw,7rem)] bg-muted rounded shrink-0 flex items-center justify-center">
                        <BookOpen className="size-[clamp(1.5rem,3.5vw,2rem)] text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-[0.3vh] min-w-0 flex-1">
                      <p className="text-[clamp(1.05rem,2.3vw,1.3rem)] font-semibold leading-tight line-clamp-2">{rental.book.title}</p>
                      <p className="text-[clamp(0.9rem,2vw,1.1rem)] text-muted-foreground truncate">{rental.book.author}</p>
                      <div className="flex items-center gap-2 mt-auto">
                        <Badge variant="outline" className="text-[clamp(0.8rem,1.7vw,1rem)] px-2.5 py-0.5">반납 완료</Badge>
                        <span className="text-[clamp(0.8rem,1.7vw,0.95rem)] text-muted-foreground">{formatShortDate(rental.returned_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    {rental.has_quiz && (
                      <Button variant="outline" className="h-[clamp(2.8rem,5.5vh,3.5rem)] flex-1 text-[clamp(0.95rem,2vw,1.2rem)] gap-1.5" onClick={() => openQuiz(rental.book.id)}>
                        <HelpCircle className="size-[clamp(1rem,2.2vw,1.3rem)]" />
                        퀴즈 풀기
                      </Button>
                    )}
                    <Button variant="outline" className="h-[clamp(2.8rem,5.5vh,3.5rem)] flex-1 text-[clamp(0.95rem,2vw,1.2rem)] gap-1.5" onClick={() => openReport(rental)} disabled={rental.has_report}>
                      <FileText className="size-[clamp(1rem,2.2vw,1.3rem)]" />
                      {rental.has_report ? "작성 완료" : "독서록 쓰기"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </main>

      {/* 독서록 작성 전용 풀스크린 에디터 */}
      {reportTarget && (
        <div className="fixed inset-0 z-[150] bg-background flex flex-col">
          <header className="shrink-0 border-b bg-background px-[3vw] py-[1.5vh] flex items-center gap-3">
            <button onClick={closeReport} className="p-1" aria-label="닫기">
              <X className="size-[clamp(1.3rem,3vw,1.6rem)]" />
            </button>
            <h1 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold flex-1">독서록 쓰기</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 text-[clamp(0.8rem,1.7vw,1rem)] font-semibold text-yellow-700 dark:text-yellow-400">
              <Candy className="size-[clamp(0.9rem,2vw,1.2rem)]" />
              +10 젤리
            </span>
          </header>

          <div className="flex flex-1 flex-col overflow-hidden px-[3vw] py-[1.5vh] gap-[1.2vh]">
            {/* 도서 정보 */}
            <div className="shrink-0 flex gap-[clamp(0.6rem,1.5vw,1rem)] items-center">
              {reportTarget.book.cover_image ? (
                <img src={reportTarget.book.cover_image} alt={reportTarget.book.title} className="w-[clamp(3rem,7vw,4.5rem)] h-[clamp(4.3rem,10vw,6.3rem)] object-cover rounded shrink-0" />
              ) : (
                <div className="w-[clamp(3rem,7vw,4.5rem)] h-[clamp(4.3rem,10vw,6.3rem)] bg-muted rounded shrink-0 flex items-center justify-center">
                  <BookOpen className="size-[clamp(1.3rem,3vw,1.8rem)] text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[clamp(1.1rem,2.4vw,1.4rem)] font-bold leading-tight line-clamp-2">{reportTarget.book.title}</p>
                <p className="text-[clamp(0.9rem,2vw,1.1rem)] text-muted-foreground truncate">{reportTarget.book.author}</p>
              </div>
            </div>

            {/* 별점 */}
            <div className="shrink-0">
              <label className="text-[clamp(0.9rem,2vw,1.1rem)] font-medium mb-1.5 block">이 책, 별점을 준다면?</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReportRating(star)}
                    className={`h-[clamp(2.8rem,6vh,3.6rem)] flex-1 rounded-xl border text-[clamp(1.4rem,3.2vw,2rem)] leading-none transition-colors ${
                      reportRating >= star
                        ? "bg-yellow-400/20 border-yellow-400 text-yellow-500"
                        : "border-input text-muted-foreground/40"
                    }`}
                    aria-label={`${star}점`}
                  >
                    {reportRating >= star ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            {/* 작성 가이드 힌트 */}
            <div className="shrink-0">
              <p className="flex items-center gap-1 text-[clamp(0.8rem,1.7vw,1rem)] text-muted-foreground mb-1.5">
                <Sparkles className="size-[clamp(0.9rem,1.9vw,1.15rem)] text-yellow-500" />
                무엇을 쓸지 막막하다면, 눌러서 시작해보세요
              </p>
              <div className="flex flex-wrap gap-2">
                {REPORT_HINTS.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => insertHint(hint)}
                    className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-[clamp(0.8rem,1.7vw,1rem)] text-primary hover:bg-primary/10 transition-colors"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>

            {/* 감상문 (남는 공간 전부 차지) */}
            <div className="flex flex-1 flex-col min-h-0">
              <textarea
                placeholder="이 책을 읽고 느낀 점을 자유롭게 적어주세요. (10자 이상)"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                maxLength={2000}
                autoFocus
                className="flex-1 min-h-0 w-full rounded-xl border border-input bg-background px-4 py-3 text-[clamp(1rem,2.1vw,1.25rem)] leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[clamp(0.75rem,1.6vw,0.95rem)] ${reportText.trim().length >= 10 ? "text-muted-foreground" : "text-primary"}`}>
                  {reportText.trim().length < 10 ? `최소 10자 (현재 ${reportText.trim().length}자)` : `${reportText.length}자`}
                </span>
                <span className="text-[clamp(0.75rem,1.6vw,0.95rem)] text-muted-foreground">{reportText.length}/2000</span>
              </div>
            </div>

            {reportError && (
              <div className="shrink-0 rounded-lg bg-destructive/10 px-3 py-2">
                <p className="text-[clamp(0.85rem,1.8vw,1rem)] text-destructive">{reportError}</p>
              </div>
            )}
          </div>

          {/* 하단 고정 등록 버튼 */}
          <div className="shrink-0 border-t bg-background px-[3vw] py-[1.2vh]">
            <Button
              className="w-full h-[clamp(3rem,6vh,3.8rem)] text-[clamp(1.05rem,2.3vw,1.35rem)] gap-2"
              disabled={!reportValid || isReportLoading}
              onClick={handleReportSubmit}
            >
              {isReportLoading ? <Loader2 className="size-5 animate-spin" /> : <Candy className="size-5" />}
              등록하고 젤리 받기
            </Button>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      <Dialog open={!!quizBookId} onOpenChange={(open) => { if (!open) { setQuizBookId(null); setQuizzes([]); setQuizAnswer(null); setQuizResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[clamp(1.2rem,3vw,1.6rem)]">독서 퀴즈</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isQuizLoading && quizzes.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
            ) : quizzes.length === 0 ? (
              <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground text-center py-8">등록된 퀴즈가 없습니다</p>
            ) : currentQuiz ? (
              <>
                {quizzes.length > 1 && <p className="text-[clamp(0.8rem,1.8vw,1rem)] text-muted-foreground">{currentQuizIdx + 1} / {quizzes.length}</p>}
                <p className="text-[clamp(1rem,2.2vw,1.3rem)] font-medium">{currentQuiz.question}</p>
                {currentQuiz.is_solved ? (
                  <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground text-center py-4">이미 풀었던 퀴즈입니다</p>
                ) : (
                  <div className="space-y-2">
                    {currentQuiz.options.map((option, i) => (
                      <Button
                        key={i}
                        variant={quizAnswer === null ? "outline" : quizResult ? (i === quizResult.correct_answer ? "default" : quizAnswer === i ? "destructive" : "outline") : quizAnswer === i ? "secondary" : "outline"}
                        className="w-full h-[clamp(3rem,6vh,4rem)] text-[clamp(1rem,2.2vw,1.3rem)] justify-start px-4"
                        onClick={() => handleQuizSubmit(currentQuiz.id, i)}
                        disabled={quizAnswer !== null}
                      >
                        {i + 1}. {option}
                      </Button>
                    ))}
                  </div>
                )}
                {quizResult && (
                  <p className={`text-[clamp(1rem,2.2vw,1.3rem)] font-semibold text-center ${quizResult.is_correct ? "text-green-600" : "text-destructive"}`}>
                    {quizResult.is_correct ? "정답입니다!" : "오답입니다."}
                  </p>
                )}
                {quizzes.length > 1 && (quizResult || currentQuiz.is_solved) && currentQuizIdx < quizzes.length - 1 && (
                  <Button variant="outline" className="w-full h-[clamp(2.8rem,5vh,3.5rem)] text-[clamp(1rem,2.2vw,1.3rem)]" onClick={() => { setCurrentQuizIdx((i) => i + 1); setQuizAnswer(null); setQuizResult(null); }}>
                    다음 문제
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
