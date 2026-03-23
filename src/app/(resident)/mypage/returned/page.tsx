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
  ChevronDown,
  ChevronUp,
  Candy,
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

  // Report
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
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

  function toggleReport(rentalId: string) {
    if (expandedReportId === rentalId) {
      setExpandedReportId(null);
    } else {
      setExpandedReportId(rentalId);
      setReportText("");
      setReportRating(0);
      setReportError(null);
    }
  }

  function handleReportSubmit(bookId: string) {
    if (reportRating === 0 || reportText.trim().length < 10) return;
    setReportError(null);
    startReportTransition(async () => {
      const formData = new FormData();
      formData.set("book_id", bookId);
      formData.set("rating", String(reportRating));
      formData.set("review", reportText);
      const result = await createBookReport(formData);
      if (result.success) {
        setReportSuccess(bookId);
        setExpandedReportId(null);
        setTimeout(() => setReportSuccess(null), 3000);
        refetch();
      } else {
        setReportError(result.error ?? "독서록 작성에 실패했습니다.");
      }
    });
  }

  const currentQuiz = quizzes[currentQuizIdx];

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
                    <Button variant="outline" className="h-[clamp(2.8rem,5.5vh,3.5rem)] flex-1 text-[clamp(0.95rem,2vw,1.2rem)] gap-1.5" onClick={() => openQuiz(rental.book.id)} disabled={!rental.has_quiz}>
                      <HelpCircle className="size-[clamp(1rem,2.2vw,1.3rem)]" />
                      {rental.has_quiz ? "퀴즈 풀기" : "퀴즈 없음"}
                    </Button>
                    <Button variant={expandedReportId === rental.id ? "secondary" : "outline"} className="h-[clamp(2.8rem,5.5vh,3.5rem)] flex-1 text-[clamp(0.95rem,2vw,1.2rem)] gap-1.5" onClick={() => toggleReport(rental.id)} disabled={rental.has_report}>
                      <FileText className="size-[clamp(1rem,2.2vw,1.3rem)]" />
                      {rental.has_report ? "작성 완료" : "독서록 쓰기"}
                      {!rental.has_report && (expandedReportId === rental.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
                    </Button>
                  </div>
                  {expandedReportId === rental.id && (
                    <div className="border-t pt-3 space-y-3">
                      {reportError && (
                        <div className="rounded-lg bg-destructive/10 px-3 py-2">
                          <p className="text-[clamp(0.85rem,1.8vw,1rem)] text-destructive">{reportError}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-[clamp(0.9rem,2vw,1.1rem)] font-medium mb-1.5 block">별점</label>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Button key={star} variant={reportRating >= star ? "default" : "outline"} className="h-[clamp(2.5rem,5vh,3.2rem)] w-[clamp(2.5rem,5vh,3.2rem)] text-[clamp(1.2rem,2.8vw,1.6rem)] p-0" onClick={() => setReportRating(star)}>
                              {reportRating >= star ? "★" : "☆"}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[clamp(0.9rem,2vw,1.1rem)] font-medium mb-1.5 block">감상문</label>
                        <textarea
                          placeholder="이 책에 대한 감상을 자유롭게 적어주세요 (10자 이상)"
                          value={reportText}
                          onChange={(e) => setReportText(e.target.value)}
                          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2.5 text-[clamp(0.95rem,2vw,1.2rem)] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                        <p className="text-[clamp(0.75rem,1.6vw,0.9rem)] text-muted-foreground mt-1">{reportText.length}자 / 최소 10자</p>
                      </div>
                      <Button className="w-full h-[clamp(2.8rem,5.5vh,3.5rem)] text-[clamp(1rem,2.2vw,1.3rem)]" disabled={reportRating === 0 || reportText.trim().length < 10 || isReportLoading} onClick={() => handleReportSubmit(rental.book.id)}>
                        {isReportLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                        등록하기
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </main>

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
