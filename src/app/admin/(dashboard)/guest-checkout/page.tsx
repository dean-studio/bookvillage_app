"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ChevronLeft,
  ChevronRight,
  Pencil,
  ScanBarcode,
  CalendarDays,
  User,
  MapPin,
} from "lucide-react";
import {
  checkoutBookGuest,
  searchGuestCandidates,
  lookupBookByBarcode,
  type GuestCandidate,
} from "@/app/actions/rentals";
import { getBooks } from "@/app/actions/books";
import { useScannerInput } from "@/hooks/use-scanner-input";

// getBooks는 books 행 전체(select *)를 돌려주므로 상세 레이어에 쓸 필드도 함께 담는다
type BookHit = {
  id: string;
  title: string;
  author: string;
  barcode: string;
  is_available: boolean;
  cover_image: string | null;
  publisher?: string | null;
  description?: string | null;
  location_group?: string;
  location_detail?: string;
};

interface CheckoutOutcome {
  title: string;
  barcode: string;
  success: boolean;
  error?: string;
}

// 단계: 누구 → (신규/수정일 때만) 연락처 → 도서 → 확인 → 결과
type Step = "who" | "contact" | "books" | "confirm" | "done";

// 확정된 대출자. id가 있으면 기존 프로필, isGuest null이면 신규
interface Person {
  id: string | null;
  name: string;
  dongHo: string;
  phone: string; // 숫자만
  isGuest: boolean | null;
}

const STEPS: { key: Exclude<Step, "done">; label: string }[] = [
  { key: "who", label: "누구" },
  { key: "contact", label: "연락처" },
  { key: "books", label: "도서" },
  { key: "confirm", label: "확인" },
];

function todayKST(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

// "101-211" / "101 211" / "101동211호" / "101211" -> "101동 211호"
function normalizeDongHo(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d+)\s*(?:동|-|\s)\s*(\d+)\s*호?$/);
  if (m) return `${m[1]}동 ${m[2]}호`;
  // 붙여 쓴 숫자는 3자리 동 + 나머지 호로 해석 (연락처·확인 단계에서 수정 가능)
  if (/^\d{4,}$/.test(s)) return `${s.slice(0, 3)}동 ${s.slice(3)}호`;
  return s;
}

// 01012345678 -> 010-1234-5678
function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

// 01012345678 -> 010-****-5678
function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 7) return d;
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

// ISBN(8~13자리 숫자) 또는 자체 바코드(BV...)인지
function looksLikeBarcode(s: string): boolean {
  return /^\d{8,13}$/.test(s) || /^bv\d+$/i.test(s);
}

const DEBOUNCE_MS = 250;

function candidateToPerson(c: GuestCandidate): Person {
  return { id: c.id, name: c.name, dongHo: c.dong_ho, phone: c.phone_number, isGuest: c.is_guest };
}

function MemberBadge({ isGuest }: { isGuest: boolean | null }) {
  if (isGuest === null) {
    return <Badge variant="outline" className="h-6 text-sm border-sky-400 text-sky-600">신규</Badge>;
  }
  return isGuest ? (
    <Badge variant="outline" className="h-6 text-sm border-amber-400 text-amber-600">비회원</Badge>
  ) : (
    <Badge variant="outline" className="h-6 text-sm border-primary/50 text-primary">회원</Badge>
  );
}

// 기존 이용자 후보 칩 — 폰에서는 한 줄 전체 폭, 두 줄(이름+배지 / 동호수·전화)
function CandidateChip({ c, onSelect }: { c: GuestCandidate; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full min-h-14 items-center gap-3 rounded-2xl border bg-background px-4 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5 active:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <User className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[17px] font-semibold">{c.name}</span>
          <MemberBadge isGuest={c.is_guest} />
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-[15px] text-muted-foreground">
          <span>{c.dong_ho}</span>
          <span>·</span>
          <span className="font-mono">{maskPhone(c.phone_number)}</span>
          {c.rental_count > 0 && <span className="ml-auto text-sm">{c.rental_count}회 대출</span>}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

// 각 단계 하단에 고정되는 버튼 영역 (폰에서는 화면 바닥에 붙음)
function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 border-t bg-background/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:mx-0 md:rounded-xl md:border md:px-3 md:py-3">
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function StepTitle({ n, children, extra }: { n: number; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-xl sm:text-[22px]">
      <Badge className="size-7 shrink-0 rounded-full p-0 text-sm flex items-center justify-center">{n}</Badge>
      {children}
      {extra}
    </CardTitle>
  );
}

export default function GuestCheckoutPage() {
  const [step, setStep] = useState<Step>("who");
  const [person, setPerson] = useState<Person | null>(null);
  const [rentedAt, setRentedAt] = useState(todayKST());
  const [error, setError] = useState("");

  // 1단계: 동호수 입력 → 기존 이용자 후보
  const [whoQuery, setWhoQuery] = useState("");
  const [whoCandidates, setWhoCandidates] = useState<GuestCandidate[]>([]);
  const [whoSearching, setWhoSearching] = useState(false);
  const [whoResultQuery, setWhoResultQuery] = useState(""); // whoCandidates가 어떤 입력의 결과인지
  const whoReqRef = useRef(0);

  // 2단계: 이름·연락처 초안 (신규 또는 기존 수정)
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftIsGuest, setDraftIsGuest] = useState<boolean | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDongHo, setDraftDongHo] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  // 2단계 완료/뒤로 시 돌아갈 곳 (신규: who, 수정: 수정을 시작한 단계)
  const [contactReturn, setContactReturn] = useState<Step>("who");
  const [phoneCandidates, setPhoneCandidates] = useState<GuestCandidate[]>([]);
  const phoneReqRef = useRef(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // 3단계: 도서 검색/바코드 + 장바구니 + 상세 레이어
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<BookHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [cart, setCart] = useState<BookHit[]>([]);
  const [flash, setFlash] = useState("");
  const [detail, setDetail] = useState<BookHit | null>(null);

  // 4단계: 대출 처리 → 결과
  const [outcomes, setOutcomes] = useState<CheckoutOutcome[] | null>(null);
  const [isPending, startTransition] = useTransition();

  // --- 1단계 후보 검색 (동호수 기준, 250ms 디바운스) ---
  useEffect(() => {
    if (step !== "who") return;
    const q = whoQuery.trim();
    const id = ++whoReqRef.current;
    const t = setTimeout(() => {
      if (!q.replace(/\D/g, "")) {
        setWhoCandidates([]);
        setWhoSearching(false);
        return;
      }
      setWhoSearching(true);
      searchGuestCandidates(q, "dong_ho").then((res) => {
        if (whoReqRef.current !== id) return; // 더 최근 입력이 있으면 버림
        setWhoCandidates(res.success ? res.data : []);
        setWhoResultQuery(q);
        setWhoSearching(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [whoQuery, step]);

  // --- 2단계 전화번호 자동완성 (250ms 디바운스) ---
  useEffect(() => {
    if (step !== "contact") return;
    const d = draftPhone.replace(/\D/g, "");
    const id = ++phoneReqRef.current;
    const t = setTimeout(() => {
      if (d.length < 3) {
        setPhoneCandidates([]);
        return;
      }
      searchGuestCandidates(d, "phone").then((res) => {
        if (phoneReqRef.current !== id) return;
        // 지금 수정 중인 본인은 제외
        setPhoneCandidates(res.success ? res.data.filter((c) => c.id !== draftId) : []);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draftPhone, step, draftId]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  // --- 단계 전환 ---
  const selectCandidate = (c: GuestCandidate) => {
    setPerson(candidateToPerson(c));
    setError("");
    setStep("books");
  };

  // 1단계에서 "새로운 분" → 동호수만 채운 채 2단계로
  const startNewPerson = () => {
    setDraftId(null);
    setDraftIsGuest(null);
    setDraftName("");
    setDraftDongHo(normalizeDongHo(whoQuery));
    setDraftPhone("");
    setPhoneCandidates([]);
    setContactReturn("who");
    setError("");
    setStep("contact");
  };

  // 선택된 사람 정보 수정 → 2단계로 (기존 값 채움). 완료하면 수정을 시작한 단계로 복귀
  const editPerson = () => {
    if (!person) return;
    setDraftId(person.id);
    setDraftIsGuest(person.isGuest);
    setDraftName(person.name);
    setDraftDongHo(person.dongHo);
    setDraftPhone(person.phone);
    setPhoneCandidates([]);
    setContactReturn(step === "confirm" ? "confirm" : "books");
    setError("");
    setStep("contact");
  };

  // 사람 바꾸기 → 1단계로 (동호수는 유지해 같은 집 후보가 바로 보이게)
  const changePerson = () => {
    setWhoQuery(person?.dongHo ?? whoQuery);
    setPerson(null);
    setError("");
    setStep("who");
  };

  const draftPhoneDigits = draftPhone.replace(/\D/g, "");
  const draftReady = !!(draftName.trim() && draftDongHo.trim() && draftPhoneDigits.length >= 10);

  const commitDraft = () => {
    if (!draftReady) return;
    setPerson({
      id: draftId,
      name: draftName.trim(),
      dongHo: normalizeDongHo(draftDongHo),
      phone: draftPhoneDigits,
      isGuest: draftIsGuest,
    });
    setError("");
    setStep(contactReturn === "confirm" ? "confirm" : "books");
  };

  const handleWhoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    // 디바운스 중이면 화면의 후보가 이전 입력 결과일 수 있으므로 무시 (엉뚱한 사람 선택 방지)
    if (whoSearching || !whoQuery.replace(/\D/g, "") || whoResultQuery !== whoQuery.trim()) return;
    if (whoCandidates.length === 1) selectCandidate(whoCandidates[0]);
    else if (whoCandidates.length === 0) startNewPerson();
    // 여러 명이면 칩을 직접 눌러 고르게 둔다
  };

  // --- 3단계 도서 ---
  const inCart = (id: string) => cart.some((x) => x.id === id);

  const toggleCart = (b: BookHit) => {
    setCart((prev) =>
      prev.some((x) => x.id === b.id) ? prev.filter((x) => x.id !== b.id) : [...prev, b]
    );
  };

  const addByBarcode = (code: string) => {
    setError("");
    startSearch(async () => {
      const res = await lookupBookByBarcode(code);
      if (!res.success) {
        setError(`${code}: ${res.error}`);
        return;
      }
      const b: BookHit = {
        id: res.data.id,
        title: res.data.title,
        author: res.data.author,
        barcode: res.data.barcode,
        is_available: res.data.is_available,
        cover_image: res.data.cover_image,
        publisher: res.data.publisher,
        location_group: res.data.location_group,
        location_detail: res.data.location_detail,
      };
      if (!b.is_available) {
        setError(`'${b.title}'은(는) 이미 대출 중입니다.`);
        return;
      }
      setCart((prev) => (prev.some((x) => x.id === b.id) ? prev : [...prev, b]));
      setBookQuery("");
      setFlash(`담았습니다: ${b.title}`);
    });
  };

  const handleTitleSearch = (q: string) => {
    setError("");
    startSearch(async () => {
      const data = await getBooks({ q, sort: "title_asc", page: 1, limit: 30 });
      setBookResults((data.books ?? []) as unknown as BookHit[]);
      setSearched(true);
    });
  };

  // 입력창 하나로 제목 검색과 바코드 입력(리더기 Enter 포함)을 모두 처리
  const handleBookSubmit = () => {
    const q = bookQuery.trim();
    if (!q) return;
    if (looksLikeBarcode(q)) addByBarcode(q);
    else handleTitleSearch(q);
  };

  // 입력창 밖에 포커스가 있어도 리더기 스캔은 받는다 (도서 단계, 상세 레이어 닫힌 상태에서만)
  useScannerInput((v) => addByBarcode(v), step === "books" && detail === null);

  // --- 4단계 대출 처리 ---
  const handleCheckout = () => {
    if (!person || cart.length === 0) return;
    setError("");
    startTransition(async () => {
      const results: CheckoutOutcome[] = [];
      for (const b of cart) {
        const formData = new FormData();
        formData.set("name", person.name);
        formData.set("dong_ho", person.dongHo);
        formData.set("phone_number", person.phone);
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
      setStep("done");
    });
  };

  // 다음 사람: 사람·도서만 비우고 대출일은 유지 (같은 종이 기록을 이어서 입력)
  const resetForNext = (keepDate: boolean) => {
    setPerson(null);
    setWhoQuery("");
    setWhoCandidates([]);
    setDraftId(null);
    setDraftIsGuest(null);
    setDraftName("");
    setDraftDongHo("");
    setDraftPhone("");
    setPhoneCandidates([]);
    setBookQuery("");
    setBookResults([]);
    setSearched(false);
    setCart([]);
    setFlash("");
    setDetail(null);
    setOutcomes(null);
    setError("");
    if (!keepDate) setRentedAt(todayKST());
    setStep("who");
  };

  // --- 진행 표시 ---
  const stepIndex = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === step);
  const contactSkipped = step !== "contact" && person !== null && person.id !== null && draftId === null;

  const progress = (
    <ol className="flex items-center gap-0.5 text-sm">
      {STEPS.map((s, i) => {
        const done = i < stepIndex || (s.key === "contact" && contactSkipped && stepIndex > 1);
        const active = i === stepIndex;
        return (
          <li key={s.key} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/50" />}
            <span
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${
                active
                  ? "bg-primary text-primary-foreground font-semibold"
                  : done
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex size-5 items-center justify-center rounded-full text-xs ${
                  active ? "bg-primary-foreground/20" : done ? "bg-primary/10" : "bg-muted"
                }`}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {/* 폰에서는 현재 단계 이름만 보여 가로 넘침 방지 */}
              <span className={active ? "" : "hidden sm:inline"}>{s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );

  // --- 선택된 사람 요약 핀 ---
  const personPill = person && step !== "done" && step !== "who" && (
    <div className="flex items-center gap-1 rounded-2xl border bg-muted/40 py-1.5 pl-2 pr-1.5">
      <button
        type="button"
        onClick={changePerson}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-base hover:bg-background"
        title="다른 사람으로 바꾸기"
      >
        <User className="size-5 text-primary shrink-0" />
        <span className="font-semibold shrink-0">{person.name}</span>
        <span className="truncate text-muted-foreground">
          {person.dongHo}
          <span className="hidden sm:inline"> · {maskPhone(person.phone)}</span>
        </span>
        <MemberBadge isGuest={person.isGuest} />
      </button>
      <Button variant="ghost" size="icon" className="size-11 rounded-xl" onClick={editPerson} aria-label="이름·연락처 수정">
        <Pencil className="size-5" />
      </Button>
    </div>
  );

  const errorBox = error && (
    <div className="flex items-center gap-2 text-base text-destructive bg-destructive/10 rounded-lg p-3">
      <AlertCircle className="size-5 shrink-0" />
      {error}
    </div>
  );

  const whoHasDigits = !!whoQuery.replace(/\D/g, "");

  // ========== 결과 ==========
  if (step === "done" && outcomes && person) {
    const okCount = outcomes.filter((o) => o.success).length;
    const allOk = okCount === outcomes.length;
    return (
      <div className="space-y-5 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold">비회원 대출</h1>
        {progress}
        <Card className={allOk ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"}>
          <CardContent className="py-8 space-y-4">
            <div className="text-center space-y-2">
              {allOk ? (
                <CheckCircle2 className="size-14 mx-auto text-green-600" />
              ) : (
                <AlertCircle className="size-14 mx-auto text-amber-600" />
              )}
              <p className="font-semibold text-xl">
                {okCount}권 대출 완료
                {okCount < outcomes.length && ` · ${outcomes.length - okCount}권 실패`}
              </p>
              <p className="text-base text-muted-foreground flex items-center justify-center gap-1.5 flex-wrap">
                <span className="font-medium text-foreground">{person.name}</span>
                <span>({person.dongHo})</span>
                <MemberBadge isGuest={person.isGuest} />
              </p>
              <p className="text-[15px] text-muted-foreground">대출일 {rentedAt}</p>
            </div>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-base ${
                    o.success ? "bg-background" : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  {o.success ? (
                    <Check className="size-5 text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle className="size-5 text-destructive shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate">{o.title}</span>
                  {!o.success && <span className="text-sm text-destructive shrink-0">{o.error}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <StickyBar>
          <Button variant="outline" onClick={() => resetForNext(false)} className="h-14 px-5 text-base">
            처음으로
          </Button>
          <Button onClick={() => resetForNext(true)} className="h-14 flex-1 text-base" autoFocus>
            <UserPlus className="size-5 mr-1" />
            다음 사람
            <span className="ml-1.5 text-xs font-normal opacity-80">대출일 유지</span>
          </Button>
        </StickyBar>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <UserPlus className="size-6" />
          비회원 대출
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          종이에 적고 간 대출 기록을 옮겨 적습니다. 동호수만 입력하면 다녀간 분은 바로 찾아 채워집니다.
        </p>
      </div>

      {progress}
      {personPill}
      {errorBox}

      {/* ========== 1단계: 누가 빌리나요? ========== */}
      {step === "who" && (
        <>
          <Card>
            <CardHeader>
              <StepTitle n={1}>누가 빌리나요?</StepTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-base text-muted-foreground">동/호수</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <Input
                    autoFocus
                    inputMode="tel"
                    placeholder="예: 101-211"
                    value={whoQuery}
                    onChange={(e) => setWhoQuery(e.target.value)}
                    onKeyDown={handleWhoKeyDown}
                    className="h-14 pl-11 text-xl md:text-xl"
                  />
                  {whoSearching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="text-[15px] leading-snug text-muted-foreground">
                  101-211, 101 211, 101동211호 모두 됩니다. 동만 쳐도 그 동 이용자가 나옵니다.
                </p>
              </div>

              {whoCandidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[15px] font-medium text-muted-foreground">
                    다녀간 분 {whoCandidates.length}명 · 눌러서 선택
                  </p>
                  <div className="flex flex-col gap-2">
                    {whoCandidates.map((c) => (
                      <CandidateChip key={c.id} c={c} onSelect={() => selectCandidate(c)} />
                    ))}
                  </div>
                </div>
              )}

              {whoHasDigits && !whoSearching && whoCandidates.length === 0 && (
                <p className="text-base text-muted-foreground">
                  <span className="font-medium text-foreground">{normalizeDongHo(whoQuery)}</span>로 다녀간 기록이 없습니다. 아래 버튼으로 새로 등록하세요.
                </p>
              )}
            </CardContent>
          </Card>
          <StickyBar>
            <Button
              variant={whoCandidates.length === 0 && !whoSearching ? "default" : "outline"}
              className="h-14 flex-1 text-base"
              disabled={!whoHasDigits}
              onClick={startNewPerson}
            >
              <UserPlus className="size-5 mr-1" />
              새로운 분이에요
              <ChevronRight className="size-5 ml-1" />
            </Button>
          </StickyBar>
        </>
      )}

      {/* ========== 2단계: 이름과 연락처 ========== */}
      {step === "contact" && (
        <>
          <Card>
            <CardHeader>
              <StepTitle
                n={2}
                extra={draftId ? <Badge variant="secondary" className="ml-1 h-6 text-sm">기존 정보 수정</Badge> : undefined}
              >
                이름과 연락처
              </StepTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-base text-muted-foreground">이름</label>
                  <Input
                    autoFocus
                    placeholder="예: 홍길동"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        phoneInputRef.current?.focus();
                      }
                    }}
                    className="h-14 text-lg md:text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-base text-muted-foreground">동/호수</label>
                  <Input
                    placeholder="예: 101동 211호"
                    value={draftDongHo}
                    onChange={(e) => setDraftDongHo(e.target.value)}
                    onBlur={() => setDraftDongHo((v) => normalizeDongHo(v))}
                    className="h-14 text-lg md:text-lg"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-base text-muted-foreground">전화번호</label>
                  <Input
                    ref={phoneInputRef}
                    inputMode="numeric"
                    placeholder="010-0000-0000"
                    value={formatPhone(draftPhone)}
                    onChange={(e) => setDraftPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        commitDraft();
                      }
                    }}
                    className="h-14 font-mono text-lg md:text-lg"
                  />
                  <p className="text-[15px] leading-snug text-muted-foreground">
                    뒷자리 몇 개만 쳐도 이미 다녀간 분이면 아래에 나옵니다. 누르면 전부 채워집니다.
                  </p>
                </div>
              </div>

              {phoneCandidates.length > 0 && (
                <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                  <p className="text-[15px] font-medium text-muted-foreground">이 번호로 다녀간 분</p>
                  <div className="flex flex-col gap-2">
                    {phoneCandidates.map((c) => (
                      <CandidateChip key={c.id} c={c} onSelect={() => selectCandidate(c)} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <StickyBar>
            <Button
              variant="outline"
              className="h-14 px-4"
              aria-label="뒤로"
              onClick={() => setStep(person && contactReturn !== "who" ? contactReturn : "who")}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button className="h-14 flex-1 text-base" disabled={!draftReady} onClick={commitDraft}>
              다음: 도서 선택
              <ChevronRight className="size-5 ml-1" />
            </Button>
          </StickyBar>
        </>
      )}

      {/* ========== 3단계: 어떤 책인가요? ========== */}
      {step === "books" && (
        <>
          <Card>
            <CardHeader>
              <StepTitle
                n={3}
                extra={cart.length > 0 ? <Badge variant="secondary" className="ml-1 h-6 text-sm">{cart.length}권 담음</Badge> : undefined}
              >
                어떤 책인가요?
              </StepTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 담은 도서 */}
              {cart.length > 0 && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
                  <p className="text-[15px] font-medium text-muted-foreground">담은 도서</p>
                  {cart.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-base min-h-11">
                      <BookOpen className="size-5 text-primary shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{b.title}</span>
                      <button
                        onClick={() => toggleCart(b)}
                        className="flex size-11 items-center justify-center -mr-2 text-muted-foreground hover:text-destructive"
                        aria-label="빼기"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                    <ScanBarcode className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="제목 검색 또는 바코드"
                      value={bookQuery}
                      onChange={(e) => setBookQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleBookSubmit();
                        }
                      }}
                      className="h-14 pl-11 text-lg md:text-lg"
                    />
                </div>
                <Button className="h-14 w-full text-base" disabled={!bookQuery.trim() || isSearching} onClick={handleBookSubmit}>
                  {isSearching ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
                  {looksLikeBarcode(bookQuery.trim()) ? "담기" : "검색"}
                </Button>
              </div>

              {flash && (
                <div className="flex items-center gap-2 text-base text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300 rounded-lg p-3">
                  <Check className="size-5 shrink-0" />
                  <span className="min-w-0 truncate">{flash}</span>
                </div>
              )}

              {searched && bookResults.length === 0 && !isSearching && (
                <p className="text-center text-muted-foreground py-6 text-base">검색 결과가 없습니다.</p>
              )}

              {bookResults.length > 0 && (
                <div className="space-y-2">
                  {bookResults.map((b) => {
                    const selected = inCart(b.id);
                    const disabled = !b.is_available && !selected;
                    return (
                      <div
                        key={b.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetail(b)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetail(b);
                          }
                        }}
                        className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition-colors hover:bg-muted/40 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          disabled ? "opacity-60 bg-muted/30" : selected ? "border-primary/50 bg-primary/5" : ""
                        }`}
                      >
                        {b.cover_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.cover_image} alt="" className="w-16 h-[5.5rem] object-cover rounded shrink-0 bg-muted" />
                        ) : (
                          <div className="w-16 h-[5.5rem] rounded shrink-0 bg-muted flex items-center justify-center">
                            <BookOpen className="size-5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-base leading-snug line-clamp-2">{b.title}</p>
                          <p className="text-[15px] text-muted-foreground truncate">{b.author}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant={b.is_available ? "default" : "outline"} className={!b.is_available ? "bg-black text-white border-black" : ""}>
                              {b.is_available ? "대출 가능" : "대출 중"}
                            </Badge>
                            {b.location_group && (
                              <span className="text-sm text-muted-foreground">{b.location_group} {b.location_detail}</span>
                            )}
                          </div>
                          <Button
                            variant={selected ? "secondary" : "default"}
                            className="mt-2.5 h-11 w-full text-base"
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCart(b);
                            }}
                          >
                            {selected ? (
                              <><Check className="size-4" />담음</>
                            ) : (
                              <><Plus className="size-4" />담기</>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <StickyBar>
            {/* 기존 이용자는 사람 다시 고르기, 신규는 입력한 이름·연락처로 돌아가기 */}
            <Button variant="outline" className="h-14 px-4" aria-label="뒤로" onClick={() => (person?.id ? changePerson() : editPerson())}>
              <ChevronLeft className="size-5" />
            </Button>
            <Button className="h-14 flex-1 text-base" disabled={cart.length === 0} onClick={() => { setError(""); setStep("confirm"); }}>
              {cart.length > 0 ? `${cart.length}권 확인하기` : "책을 담아주세요"}
              <ChevronRight className="size-5 ml-1" />
            </Button>
          </StickyBar>

          {/* 도서 상세 레이어 — 폰에서는 바텀시트, 데스크톱에서는 가운데 다이얼로그 */}
          <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
            <DialogContent
              showCloseButton={false}
              className="gap-0 p-0 overflow-hidden text-base max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-2xl sm:max-w-md"
            >
              {detail && (() => {
                const selected = inCart(detail.id);
                const disabled = !detail.is_available && !selected;
                return (
                  <>
                    <div className="max-h-[75vh] overflow-y-auto p-5 pb-4 space-y-4">
                      <div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/30 sm:hidden -mt-2" />
                      <div className="flex justify-center">
                        {detail.cover_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={detail.cover_image} alt="" className="h-52 w-36 rounded-lg object-cover bg-muted shadow-md" />
                        ) : (
                          <div className="h-52 w-36 rounded-lg bg-muted flex items-center justify-center">
                            <BookOpen className="size-10 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <DialogHeader className="gap-1 text-center">
                        <DialogTitle className="text-xl leading-snug font-semibold">{detail.title}</DialogTitle>
                        <DialogDescription className="text-base">
                          {detail.author}
                          {detail.publisher && <span className="text-muted-foreground"> · {detail.publisher}</span>}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <Badge variant={detail.is_available ? "default" : "outline"} className={`h-6 text-sm ${!detail.is_available ? "bg-black text-white border-black" : ""}`}>
                          {detail.is_available ? "대여 가능" : "대출 중"}
                        </Badge>
                        {(detail.location_group || detail.location_detail) && (
                          <Badge variant="secondary" className="h-6 text-sm">
                            <MapPin className="size-3.5" />
                            {detail.location_group} {detail.location_detail}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="h-6 font-mono text-sm">
                          {detail.barcode?.toUpperCase().startsWith("BV") ? `자체 ${detail.barcode}` : `ISBN ${detail.barcode}`}
                        </Badge>
                      </div>
                      {detail.description && (
                        <p className="text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">
                          {detail.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                      <Button variant="outline" className="h-14 px-5 text-base" onClick={() => setDetail(null)}>
                        닫기
                      </Button>
                      <Button
                        className="h-14 flex-1 text-base"
                        variant={selected ? "secondary" : "default"}
                        disabled={disabled}
                        onClick={() => {
                          toggleCart(detail);
                          setDetail(null);
                        }}
                      >
                        {disabled ? (
                          "대출 중이라 담을 수 없어요"
                        ) : selected ? (
                          <><X className="size-5" />빼기</>
                        ) : (
                          <><Plus className="size-5" />담기</>
                        )}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ========== 4단계: 확인 ========== */}
      {step === "confirm" && person && (
        <>
          <Card>
            <CardHeader>
              <StepTitle n={4}>확인</StepTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 대출자 */}
              <div className="rounded-xl border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-medium text-muted-foreground">대출자</p>
                  <Button variant="ghost" className="h-10 px-3 text-base" onClick={editPerson}>
                    <Pencil className="size-4" />수정
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-base">
                  <span className="font-semibold text-lg">{person.name}</span>
                  <span>{person.dongHo}</span>
                  <MemberBadge isGuest={person.isGuest} />
                </div>
                <p className="font-mono text-base text-muted-foreground">{formatPhone(person.phone)}</p>
                {person.isGuest === null && (
                  <p className="text-[15px] text-muted-foreground">처음 오신 분으로 새로 등록됩니다.</p>
                )}
              </div>

              {/* 도서 */}
              <div className="rounded-xl border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-medium text-muted-foreground">도서 {cart.length}권</p>
                  <Button variant="ghost" className="h-10 px-3 text-base" onClick={() => setStep("books")}>
                    <Plus className="size-4" />더 담기
                  </Button>
                </div>
                {cart.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-base min-h-11">
                    <BookOpen className="size-5 text-primary shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{b.title}</span>
                    <button
                      onClick={() => toggleCart(b)}
                      className="flex size-11 items-center justify-center -mr-2 text-muted-foreground hover:text-destructive"
                      aria-label="빼기"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                ))}
                {cart.length === 0 && (
                  <p className="text-base text-muted-foreground">담은 책이 없습니다.</p>
                )}
              </div>

              {/* 대출일 */}
              <div className="rounded-xl border p-3 space-y-1.5">
                <label className="text-[15px] font-medium text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  대출일
                </label>
                <Input
                  type="date"
                  value={rentedAt}
                  max={todayKST()}
                  onChange={(e) => setRentedAt(e.target.value)}
                  className="h-14 text-lg md:text-lg"
                />
                <p className="text-[15px] leading-snug text-muted-foreground">
                  종이 기록을 옮길 때 실제 빌려간 날짜로 바꾸세요. 다음 사람에게도 유지됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
          <StickyBar>
            <Button variant="outline" className="h-14 px-4" aria-label="뒤로" onClick={() => setStep("books")} disabled={isPending}>
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              autoFocus
              className="h-14 flex-1 text-base shadow-lg"
              disabled={cart.length === 0 || !rentedAt || isPending}
              onClick={handleCheckout}
            >
              {isPending ? (
                <><Loader2 className="size-5 animate-spin" />대출 처리 중...</>
              ) : (
                <><CheckCircle2 className="size-5" />{cart.length}권 대출하기</>
              )}
            </Button>
          </StickyBar>
        </>
      )}
    </div>
  );
}
