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
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  BookOpen,
  UserPlus,
  Plus,
  Check,
  X,
} from "lucide-react";
import { checkoutBookGuest } from "@/app/actions/rentals";
import { getBooks } from "@/app/actions/books";

type BookHit = { id: string; title: string; author: string; barcode: string; is_available: boolean; cover_image: string | null };

interface CheckoutOutcome {
  title: string;
  barcode: string;
  success: boolean;
  error?: string;
}

function todayKST(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

// "101-211" -> "101동 211호"
function formatDongHo(raw: string): string {
  const m = raw.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return `${m[1]}동 ${m[2]}호`;
  return raw.trim();
}

export default function GuestCheckoutPage() {
  const [name, setName] = useState("");
  const [dongHo, setDongHo] = useState("");
  const [phone, setPhone] = useState("");
  const [rentedAt, setRentedAt] = useState(todayKST());

  const [outcomes, setOutcomes] = useState<CheckoutOutcome[] | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // 도서 제목 검색
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<BookHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [isSearching, startSearch] = useTransition();

  // 선택된 도서 목록 (여러 권)
  const [cart, setCart] = useState<BookHit[]>([]);

  const infoReady = !!(name.trim() && dongHo.trim() && phone.replace(/\D/g, "").length >= 10);

  const handleBookSearch = () => {
    const q = bookQuery.trim();
    if (!q) return;
    setError("");
    startSearch(async () => {
      const data = await getBooks({ q, sort: "title_asc", page: 1, limit: 30 });
      setBookResults((data.books ?? []) as unknown as BookHit[]);
      setSearched(true);
    });
  };

  const toggleCart = (b: BookHit) => {
    setCart((prev) =>
      prev.some((x) => x.id === b.id) ? prev.filter((x) => x.id !== b.id) : [...prev, b]
    );
  };

  const inCart = (id: string) => cart.some((x) => x.id === id);

  const handleCheckout = () => {
    if (!infoReady || cart.length === 0) return;
    setError("");
    startTransition(async () => {
      const results: CheckoutOutcome[] = [];
      for (const b of cart) {
        const formData = new FormData();
        formData.set("name", name.trim());
        formData.set("dong_ho", formatDongHo(dongHo));
        formData.set("phone_number", phone.replace(/\D/g, ""));
        formData.set("rented_at", rentedAt);
        formData.set("barcode", b.barcode);

        const res = await checkoutBookGuest(formData);
        results.push({
          title: b.title,
          barcode: b.barcode,
          success: res.success,
          error: res.success ? undefined : res.error,
        });
      }
      setOutcomes(results);
    });
  };

  const handleReset = () => {
    setName("");
    setDongHo("");
    setPhone("");
    setRentedAt(todayKST());
    setBookQuery("");
    setBookResults([]);
    setSearched(false);
    setCart([]);
    setOutcomes(null);
    setError("");
  };

  if (outcomes) {
    const okCount = outcomes.filter((o) => o.success).length;
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold">비회원 대출</h1>
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-8 space-y-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="size-12 mx-auto text-green-600" />
              <p className="font-semibold text-lg">
                {okCount}권 대출 완료
                {okCount < outcomes.length && ` · ${outcomes.length - okCount}권 실패`}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{name.trim()}</span>{" "}
                ({formatDongHo(dongHo)}){" "}
                <Badge variant="outline" className="ml-1 border-amber-400 text-amber-600">게스트</Badge>
              </p>
            </div>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                    o.success ? "bg-background" : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  {o.success ? (
                    <Check className="size-4 text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 text-destructive shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate">{o.title}</span>
                  {!o.success && <span className="text-xs text-destructive shrink-0">{o.error}</span>}
                </div>
              ))}
            </div>
            <div className="text-center">
              <Button variant="outline" onClick={handleReset} className="h-12 px-6">
                다음 대출 처리
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <UserPlus className="size-6" />
          비회원 대출
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          앱 가입 없이 종이에 적고 가는 이용자를 등록해 대여합니다. 반납은 일반 반납 페이지에서 바코드로 처리됩니다.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: 이용자 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="rounded-full size-6 p-0 flex items-center justify-center">1</Badge>
            이용자 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">동/호수</label>
            <Input
              placeholder="예: 101-211"
              value={dongHo}
              onChange={(e) => setDongHo(e.target.value)}
              onBlur={() => setDongHo((v) => formatDongHo(v))}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              101-211 입력 시 <span className="font-medium text-foreground">101동 211호</span>로 자동 변환됩니다.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">이름</label>
            <Input placeholder="예: 홍길동" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">전화번호</label>
            <Input
              placeholder="숫자만 입력"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              className="h-11 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">대출일</label>
            <Input type="date" value={rentedAt} onChange={(e) => setRentedAt(e.target.value)} className="h-11" />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: 도서 제목 검색 (여러 권 선택) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant={infoReady ? "default" : "outline"} className="rounded-full size-6 p-0 flex items-center justify-center">2</Badge>
            도서 선택
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-1">{cart.length}권 선택됨</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!infoReady && (
            <p className="text-sm text-muted-foreground">먼저 이용자 정보(동/호수·이름·전화번호)를 입력하세요.</p>
          )}

          {/* 선택된 도서 목록 */}
          {cart.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">선택된 도서</p>
              {cart.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm">
                  <BookOpen className="size-4 text-primary shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{b.title}</span>
                  <button
                    onClick={() => toggleCart(b)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="선택 해제"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="도서 제목으로 검색"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBookSearch()}
                disabled={!infoReady}
                className="h-12 pl-10"
              />
            </div>
            <Button className="h-12 px-6" disabled={!infoReady || !bookQuery.trim() || isSearching} onClick={handleBookSearch}>
              {isSearching ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Search className="size-4 mr-2" />}
              검색
            </Button>
          </div>

          {searched && bookResults.length === 0 && !isSearching && (
            <p className="text-center text-muted-foreground py-6 text-sm">검색 결과가 없습니다.</p>
          )}

          {bookResults.length > 0 && (
            <div className="space-y-2">
              {bookResults.map((b) => {
                const isSelf = b.barcode?.toUpperCase().startsWith("BV");
                const selected = inCart(b.id);
                return (
                  <div key={b.id} className="flex items-center gap-3 border rounded-lg p-3">
                    {b.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.cover_image} alt="" className="w-10 h-14 object-cover rounded shrink-0 bg-muted" />
                    ) : (
                      <div className="w-10 h-14 rounded shrink-0 bg-muted flex items-center justify-center">
                        <BookOpen className="size-5 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{b.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{b.author}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant={b.is_available ? "default" : "outline"} className={!b.is_available ? "bg-black text-white border-black" : ""}>
                          {b.is_available ? "대출 가능" : "대출 중"}
                        </Badge>
                        <Badge variant="secondary" className="font-mono text-[0.7rem]">
                          {isSelf ? `자체 ${b.barcode}` : `ISBN ${b.barcode}`}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={selected ? "secondary" : "default"}
                      className="shrink-0"
                      disabled={!b.is_available && !selected}
                      onClick={() => toggleCart(b)}
                    >
                      {selected ? (
                        <><Check className="size-4 mr-1" />선택됨</>
                      ) : (
                        <><Plus className="size-4 mr-1" />선택</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 대출 처리 버튼 */}
      {cart.length > 0 && (
        <div className="sticky bottom-4">
          <Button
            className="w-full h-14 text-base shadow-lg"
            disabled={!infoReady || isPending}
            onClick={handleCheckout}
          >
            {isPending ? (
              <><Loader2 className="size-5 mr-2 animate-spin" />대출 처리 중...</>
            ) : (
              <><CheckCircle2 className="size-5 mr-2" />{cart.length}권 대출하기</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
