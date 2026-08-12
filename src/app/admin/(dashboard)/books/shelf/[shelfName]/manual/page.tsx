"use client";

import { useState, useEffect, useTransition, useRef, use } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Search,
  Loader2,
  Camera,
  X,
  AlertCircle,
  CheckCircle2,
  BookPlus,
} from "lucide-react";
import { createBook, checkBarcodeExists, generateBarcodes } from "@/app/actions/books";
import { getCurrentUser } from "@/app/actions/auth";
import { uploadBookCoverImage } from "@/lib/storage";
import { hangulToLatinKeys } from "@/lib/utils";

interface BookInfo {
  title: string;
  author: string;
  publisher: string;
  cover_image: string;
  isbn: string;
  description: string;
  translators?: string;
  published_at?: string;
  price?: number;
  sale_price?: number;
  category?: string;
  kakao_url?: string;
  sale_status?: string;
}

const EMPTY: BookInfo = {
  title: "",
  author: "",
  publisher: "",
  cover_image: "",
  isbn: "",
  description: "",
};

function normalizeSelfBarcode(input: string): string {
  // 리더기가 한글 IME 상태로 찍은 경우(BV→ㅠㅍ) 영문으로 복원
  const s = hangulToLatinKeys(input).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return `BV${s.padStart(6, "0")}`;
  const m = s.match(/^BV0*(\d+)$/i);
  if (m) return `BV${m[1].padStart(6, "0")}`;
  return s.toUpperCase();
}

export default function ManualRegisterPage({
  params,
}: {
  params: Promise<{ shelfName: string }>;
}) {
  const { shelfName: rawShelf } = use(params);
  const shelfName = decodeURIComponent(rawShelf);

  const [book, setBook] = useState<BookInfo>(EMPTY);
  const [customBarcode, setCustomBarcode] = useState("");
  const [isbnInput, setIsbnInput] = useState(""); // 실제 도서 ISBN 직접 입력
  const [locationDetail, setLocationDetail] = useState("");
  const [rentalDays, setRentalDays] = useState("");

  const [barcodeCheck, setBarcodeCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [barcodeCheckTitle, setBarcodeCheckTitle] = useState("");
  const [isbnCheck, setIsbnCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [isbnCheckTitle, setIsbnCheckTitle] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isRegistering, startRegister] = useTransition();

  const [adminName, setAdminName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBarcode, setConfirmBarcode] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 도서명 검색
  const [titleQuery, setTitleQuery] = useState("");
  const [titleResults, setTitleResults] = useState<BookInfo[]>([]);
  const [titleOpen, setTitleOpen] = useState(false);
  const [isTitleSearching, startTitleSearch] = useTransition();
  const [titleError, setTitleError] = useState("");

  useEffect(() => {
    getCurrentUser().then((u) => { if (u?.name) setAdminName(u.name); });
  }, []);

  // 자체 바코드 중복 자동 검색 (디바운스)
  useEffect(() => {
    const raw = customBarcode.trim();
    if (!raw) { setBarcodeCheck("idle"); setBarcodeCheckTitle(""); return; }
    setBarcodeCheck("checking");
    const t = setTimeout(async () => {
      const existing = await checkBarcodeExists(normalizeSelfBarcode(raw));
      if (existing.exists) {
        setBarcodeCheck("taken");
        setBarcodeCheckTitle(existing.book?.title || "");
      } else {
        setBarcodeCheck("available");
        setBarcodeCheckTitle("");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [customBarcode]);

  // ISBN 직접 입력 중복 자동 검색 (디바운스)
  useEffect(() => {
    const raw = isbnInput.trim();
    if (!raw) { setIsbnCheck("idle"); setIsbnCheckTitle(""); return; }
    setIsbnCheck("checking");
    const t = setTimeout(async () => {
      const existing = await checkBarcodeExists(raw);
      if (existing.exists) {
        setIsbnCheck("taken");
        setIsbnCheckTitle(existing.book?.title || "");
      } else {
        setIsbnCheck("available");
        setIsbnCheckTitle("");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [isbnInput]);

  async function uploadCover(file: File) {
    setIsUploading(true);
    try {
      const url = await uploadBookCoverImage(file);
      if (url) setBook((p) => ({ ...p, cover_image: url }));
      else setError("이미지 업로드에 실패했습니다.");
    } catch {
      setError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleTitleSearch() {
    const q = titleQuery.trim();
    if (!q) return;
    setTitleError("");
    startTitleSearch(async () => {
      try {
        const res = await fetch(`/api/books/search?title=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) { setTitleError(data.error || "검색 실패"); return; }
        setTitleResults((data.results || []) as BookInfo[]);
        if (!data.results?.length) setTitleError("검색 결과가 없습니다.");
      } catch {
        setTitleError("검색 중 오류가 발생했습니다.");
      }
    });
  }

  function selectResult(b: BookInfo) {
    setBook(b);
    setTitleOpen(false);
    setTitleResults([]);
    setTitleQuery("");
    setError("");
  }

  function openConfirm() {
    if (!book.title.trim()) { setError("도서명을 입력해주세요."); return; }
    setError("");
    startRegister(async () => {
      const isbn = isbnInput.trim();
      const custom = customBarcode.trim();
      // 우선순위: ISBN 직접 입력 > 자체 바코드 > 자동 발급
      let finalBarcode = "";
      if (isbn) {
        finalBarcode = isbn; // 실제 도서 ISBN 그대로
      } else if (custom) {
        finalBarcode = normalizeSelfBarcode(custom);
      } else {
        const gen = await generateBarcodes(1);
        if (gen.success && gen.data?.codes[0]) finalBarcode = gen.data.codes[0];
        else { setError("바코드 자동 생성 실패"); return; }
      }
      // 이미 등록된 바코드(ISBN 포함)인지 유효성 체크
      const existing = await checkBarcodeExists(finalBarcode);
      if (existing.exists) {
        setError(`이미 등록된 도서입니다: ${finalBarcode} (${existing.book?.title || ""})`);
        return;
      }
      setConfirmBarcode(finalBarcode);
      setConfirmOpen(true);
    });
  }

  function doRegister() {
    setConfirmOpen(false);
    startRegister(async () => {
      const fd = new FormData();
      fd.set("barcode", confirmBarcode);
      fd.set("title", book.title);
      fd.set("author", book.author);
      fd.set("publisher", book.publisher);
      fd.set("cover_image", book.cover_image);
      fd.set("description", book.description);
      fd.set("isbn", isbnInput.trim() || book.isbn || "");
      fd.set("translators", book.translators || "");
      fd.set("published_at", book.published_at || "");
      fd.set("price", String(book.price || 0));
      fd.set("sale_price", String(book.sale_price || 0));
      fd.set("category", book.category || "");
      fd.set("kakao_url", book.kakao_url || "");
      fd.set("sale_status", book.sale_status || "");
      fd.set("location_group", shelfName);
      fd.set("location_detail", locationDetail.trim());
      if (rentalDays.trim()) fd.set("rental_days", rentalDays.trim());

      const result = await createBook(fd);
      if (!result.success) { setError(result.error || "등록 실패"); return; }
      // 성공 → 초기화(연속 등록 편의)
      setSuccess(`"${book.title}" 등록 완료 (${confirmBarcode})`);
      setBook(EMPTY);
      setCustomBarcode("");
      setIsbnInput("");
      setLocationDetail("");
      setRentalDays("");
      setBarcodeCheck("idle");
      setConfirmBarcode("");
      setTimeout(() => setSuccess(""), 3000);
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); if (fileInputRef.current) fileInputRef.current.value = ""; }} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/admin/books/shelf/${encodeURIComponent(shelfName)}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            돌아가기
          </Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold">도서 자체 등록</h1>
        <Badge variant="secondary">{shelfName}</Badge>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          {/* 도서명 검색 버튼 */}
          <Button variant="outline" className="w-full h-12" onClick={() => { setTitleOpen(true); setTitleError(""); setTitleResults([]); setTitleQuery(""); }}>
            <Search className="size-4 mr-1" />
            도서명으로 검색해서 정보 채우기
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="size-4 shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 rounded-lg p-3">
              <CheckCircle2 className="size-4 shrink-0" />{success}
            </div>
          )}

          <div className="flex gap-4">
            {/* 표지 */}
            <div className="flex flex-col items-center gap-2 outline-none shrink-0" tabIndex={0}
              onPaste={(e) => {
                const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
                if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) uploadCover(f); }
              }}>
              {book.cover_image ? (
                <div className="relative">
                  <img src={book.cover_image} alt="" className="w-24 h-32 object-cover rounded shadow" />
                  <button type="button" className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                    onClick={() => setBook({ ...book, cover_image: "" })}>
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                  className="w-24 h-32 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  {isUploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (<><Camera className="size-5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">표지 추가</span></>)}
                </button>
              )}
              <span className="text-[10px] text-muted-foreground text-center">클릭 후 ⌘V</span>
            </div>

            {/* 기본 정보 */}
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">도서명 *</label>
                <Input value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} className="h-10" placeholder="도서명" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">저자</label>
                <Input value={book.author} onChange={(e) => setBook({ ...book, author: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">출판사</label>
                <Input value={book.publisher} onChange={(e) => setBook({ ...book, publisher: e.target.value })} className="h-10" />
              </div>
            </div>
          </div>

          <hr />

          <div className="space-y-3">
            {/* 자체 바코드 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-blue-600">자체 바코드</label>
              <Input
                placeholder="예: 20 → BV000020"
                value={customBarcode}
                onChange={(e) => setCustomBarcode(e.target.value)}
                onBlur={() => { const n = normalizeSelfBarcode(customBarcode); if (n) setCustomBarcode(n); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const n = normalizeSelfBarcode(customBarcode); if (n) setCustomBarcode(n); } }}
                className="h-10"
                disabled={!!isbnInput.trim()}
              />
              {customBarcode.trim() ? (
                <p className="text-xs flex items-center gap-1">
                  <span className="text-muted-foreground">→ <b className="font-mono text-foreground">{normalizeSelfBarcode(customBarcode)}</b></span>
                  {barcodeCheck === "checking" && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                  {barcodeCheck === "available" && <span className="text-green-600 font-medium">✓ 사용가능</span>}
                  {barcodeCheck === "taken" && <span className="text-destructive font-medium">✗ 사용중{barcodeCheckTitle ? ` (${barcodeCheckTitle})` : ""}</span>}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">비워두면 자동 발급 (BV…)</p>
              )}
            </div>
            {/* ISBN 직접 입력 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-emerald-600">실제 도서 ISBN (검색 안 되는 도서용)</label>
              <Input
                placeholder="예: 9788912345678"
                value={isbnInput}
                onChange={(e) => setIsbnInput(e.target.value.replace(/[^0-9Xx]/g, ""))}
                className="h-10"
                inputMode="numeric"
                disabled={!!customBarcode.trim()}
              />
              {isbnInput.trim() && (
                <p className="text-xs flex items-center gap-1">
                  {isbnCheck === "checking" && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                  {isbnCheck === "available" && <span className="text-green-600 font-medium">✓ 사용가능</span>}
                  {isbnCheck === "taken" && <span className="text-destructive font-medium">✗ 이미 등록됨{isbnCheckTitle ? ` (${isbnCheckTitle})` : ""}</span>}
                </p>
              )}
              <p className="text-xs text-muted-foreground">책 뒷면 ISBN 바코드를 그대로 등록합니다. 자체 바코드와 함께 쓸 수 없어요.</p>
            </div>
            {/* 상세 위치 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">상세 위치</label>
              <Input placeholder="예: A-3" value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">대여 기간 (선택)</label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={90} placeholder="기본값" value={rentalDays} onChange={(e) => setRentalDays(e.target.value)} className="h-10 w-28" />
              <span className="text-sm text-muted-foreground">일</span>
            </div>
          </div>

          <Button className="w-full h-12 text-base font-semibold" onClick={openConfirm} disabled={isRegistering || !book.title.trim() || barcodeCheck === "taken" || isbnCheck === "taken"}>
            {isRegistering ? <Loader2 className="size-4 mr-1 animate-spin" /> : <BookPlus className="size-4 mr-1" />}
            등록하기
          </Button>
        </CardContent>
      </Card>

      {/* 도서명 검색 다이얼로그 */}
      <Dialog open={titleOpen} onOpenChange={setTitleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">도서명으로 검색</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input autoFocus placeholder="도서명을 입력하세요" value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTitleSearch()} />
              <Button onClick={handleTitleSearch} disabled={isTitleSearching || !titleQuery.trim()}>
                {isTitleSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            {titleError && <p className="text-sm text-destructive">{titleError}</p>}
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {titleResults.map((b, i) => (
                <button key={`${b.isbn}-${i}`} type="button" onClick={() => selectResult(b)}
                  className="flex gap-3 w-full text-left rounded-lg border p-2 hover:bg-muted/50 active:bg-muted transition-colors">
                  {b.cover_image ? (
                    <img src={b.cover_image} alt="" className="w-12 h-16 object-cover rounded shrink-0 bg-muted" />
                  ) : (
                    <div className="w-12 h-16 rounded shrink-0 bg-muted flex items-center justify-center"><BookPlus className="size-4 text-muted-foreground/40" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-2">{b.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.publisher}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 등록 확인 다이얼로그 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">도서를 등록할까요?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 divide-y">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-muted-foreground">담당 사서</span>
                <span className="text-base font-semibold">{adminName || "-"}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 gap-3">
                <span className="text-sm text-muted-foreground shrink-0">도서명</span>
                <span className="text-base font-semibold text-right line-clamp-2">{book.title}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-muted-foreground">자체 바코드</span>
                <span className="text-base font-semibold font-mono">{confirmBarcode}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-muted-foreground">서재 위치</span>
                <span className="text-base font-semibold">{shelfName}{locationDetail ? ` > ${locationDetail}` : ""}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setConfirmOpen(false)} disabled={isRegistering}>취소</Button>
              <Button className="flex-1 h-12 font-semibold" onClick={doRegister} disabled={isRegistering}>
                {isRegistering ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}등록하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
