"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookPlus,
  X,
  RotateCcw,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { getShelves } from "@/app/actions/shelves";
import { createBook, checkBarcodeExists } from "@/app/actions/books";
import { uploadBookCoverImage } from "@/lib/storage";

type BookInfo = {
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
};

type ShelfOption = {
  id: string;
  name: string;
  type: "shelf" | "label";
};

export function MobileRegister() {
  const [scanning, setScanning] = useState(false);
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [selectedShelf, setSelectedShelf] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [isRegistering, startRegister] = useTransition();
  const [registered, setRegistered] = useState(false);
  const scannerRef = useRef<unknown>(null);

  const [rentalDays, setRentalDays] = useState("");

  // Hybrid barcode state
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [customBarcode, setCustomBarcode] = useState("");

  // Manual entry mode (ISBN 없는 도서)
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Image upload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadShelves = useCallback(async () => {
    const data = await getShelves();
    setShelves(
      (data as unknown as ShelfOption[]).filter((s) => s.type === "shelf")
    );
  }, []);

  useEffect(() => {
    loadShelves();
  }, [loadShelves]);

  async function searchByBarcode(isbn: string) {
    setSearching(true);
    setError("");
    setDuplicateDetected(false);
    setCustomBarcode("");
    try {
      // Step 1: Check if barcode already exists
      const existing = await checkBarcodeExists(isbn);
      if (existing.exists && existing.book) {
        setDuplicateDetected(true);
        setBookInfo({
          title: existing.book.title,
          author: existing.book.author || "",
          publisher: existing.book.publisher || "",
          cover_image: existing.book.cover_image || "",
          isbn: isbn,
          description: existing.book.description || "",
        });
        setBarcode(isbn);
        return;
      }

      // Step 2: Search via Kakao API
      const res = await fetch(`/api/books/search?isbn=${encodeURIComponent(isbn)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "도서 정보를 찾을 수 없습니다.");
        setBookInfo(null);
        setBarcode(isbn);
      } else {
        setBookInfo(data);
        setBarcode(isbn);
      }
    } catch {
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  }

  async function startScanning() {
    setScanning(true);
    setError("");
    setBookInfo(null);
    setRegistered(false);
    setDuplicateDetected(false);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("barcode-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText: string) => {
          html5QrCode.stop().then(() => {
            scannerRef.current = null;
            setScanning(false);
            searchByBarcode(decodedText);
          });
        },
        () => {}
      );
    } catch {
      setError("카메라를 사용할 수 없습니다. 수동 입력을 이용해주세요.");
      setScanning(false);
    }
  }

  function stopScanning() {
    const scanner = scannerRef.current as { stop: () => Promise<void> } | null;
    if (scanner) {
      scanner.stop().then(() => {
        scannerRef.current = null;
      });
    }
    setScanning(false);
  }

  function handleManualSearch() {
    if (!manualBarcode.trim()) return;
    searchByBarcode(manualBarcode.trim());
  }

  function handleRegister() {
    if (!bookInfo || !selectedShelf) return;
    if (!bookInfo.title.trim()) {
      setError("도서명을 입력해주세요.");
      return;
    }
    const finalBarcode = manualEntryMode ? customBarcode.trim() : (duplicateDetected ? customBarcode.trim() : barcode);
    if ((manualEntryMode || duplicateDetected) && !finalBarcode) return;

    startRegister(async () => {
      const formData = new FormData();
      formData.set("barcode", finalBarcode);
      formData.set("title", bookInfo.title);
      formData.set("author", bookInfo.author);
      formData.set("publisher", bookInfo.publisher);
      formData.set("cover_image", bookInfo.cover_image);
      formData.set("description", bookInfo.description);
      formData.set("isbn", bookInfo.isbn || "");
      formData.set("translators", bookInfo.translators || "");
      formData.set("published_at", bookInfo.published_at || "");
      formData.set("price", String(bookInfo.price || 0));
      formData.set("sale_price", String(bookInfo.sale_price || 0));
      formData.set("category", bookInfo.category || "");
      formData.set("kakao_url", bookInfo.kakao_url || "");
      formData.set("sale_status", bookInfo.sale_status || "");
      formData.set("location_group", selectedShelf);
      formData.set("location_detail", locationDetail);
      if (rentalDays.trim()) formData.set("rental_days", rentalDays.trim());

      const result = await createBook(formData);
      if (result.success) {
        setRegistered(true);
      } else {
        setError(result.error || "도서 등록에 실패했습니다.");
      }
    });
  }

  function startManualEntry() {
    setManualEntryMode(true);
    setBookInfo({
      title: "",
      author: "",
      publisher: "",
      cover_image: "",
      isbn: "",
      description: "",
    });
    setBarcode("");
    setCustomBarcode("");
    setError("");
    setDuplicateDetected(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bookInfo) return;
    setIsUploading(true);
    try {
      const url = await uploadBookCoverImage(file);
      if (url) {
        setBookInfo({ ...bookInfo, cover_image: url });
      } else {
        setError("이미지 업로드에 실패했습니다.");
      }
    } catch {
      setError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function resetAll() {
    setBookInfo(null);
    setBarcode("");
    setManualBarcode("");
    setError("");
    setSelectedShelf("");
    setLocationDetail("");
    setRegistered(false);
    setDuplicateDetected(false);
    setCustomBarcode("");
    setRentalDays("");
    setManualEntryMode(false);
  }

  // Registered success
  if (registered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="size-16 text-green-500" />
          <h2 className="text-xl font-bold">도서 등록 완료</h2>
          <p className="text-sm text-muted-foreground text-center">
            {bookInfo?.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedShelf} {locationDetail && `> ${locationDetail}`}
          </p>
        </div>
        <Button size="lg" className="w-full max-w-xs h-14 text-lg" onClick={resetAll}>
          <BookPlus className="size-5 mr-2" />
          다음 도서 등록
        </Button>
      </div>
    );
  }

  // Scanning view
  if (scanning) {
    return (
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">바코드 스캔</h2>
          <Button variant="ghost" size="sm" onClick={stopScanning}>
            <X className="size-4 mr-1" />
            취소
          </Button>
        </div>
        <div
          id="barcode-reader"
          className="w-full rounded-lg overflow-hidden bg-black"
          style={{ minHeight: 300 }}
        />
        <p className="text-xs text-center text-muted-foreground">
          책 뒷면의 바코드를 카메라에 비춰주세요
        </p>
      </div>
    );
  }

  // Book info + registration form
  if (bookInfo) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">도서 정보</h2>
          <Button variant="ghost" size="sm" onClick={resetAll}>
            <RotateCcw className="size-4 mr-1" />
            처음으로
          </Button>
        </div>

        {/* Manual entry barcode input */}
        {manualEntryMode && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <BookPlus className="size-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  수동 등록 모드
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  ISBN이 없는 도서입니다. 자체 바코드를 붙이고 번호를 입력해주세요.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">자체 바코드 *</label>
              <Input
                placeholder="자체 바코드 번호 입력"
                value={customBarcode}
                onChange={(e) => setCustomBarcode(e.target.value)}
                className="h-12"
              />
            </div>
          </div>
        )}

        {/* Duplicate detection warning */}
        {duplicateDetected && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  이미 등록된 도서입니다
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  복본(같은 책 2권 이상)인 경우 자체 바코드 스티커를 붙이고 입력해주세요.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">자체 바코드</label>
              <Input
                placeholder="자체 바코드 번호 입력"
                value={customBarcode}
                onChange={(e) => setCustomBarcode(e.target.value)}
                className="h-12"
              />
            </div>
          </div>
        )}

        {/* Cover image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="flex flex-col items-center gap-2">
          {bookInfo.cover_image ? (
            <div className="relative">
              <img
                src={bookInfo.cover_image}
                alt={bookInfo.title}
                className="w-24 h-32 object-cover rounded shadow"
              />
              <button
                type="button"
                className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                onClick={() => setBookInfo({ ...bookInfo, cover_image: "" })}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-24 h-32 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {isUploading ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Camera className="size-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">표지 추가</span>
                </>
              )}
            </button>
          )}
          {bookInfo.cover_image && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="size-3 animate-spin mr-1" /> : <Camera className="size-3 mr-1" />}
              표지 변경
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">도서명</label>
            <Input value={bookInfo.title} onChange={(e) => setBookInfo({ ...bookInfo, title: e.target.value })} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">저자</label>
            <Input value={bookInfo.author} onChange={(e) => setBookInfo({ ...bookInfo, author: e.target.value })} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">출판사</label>
            <Input value={bookInfo.publisher} onChange={(e) => setBookInfo({ ...bookInfo, publisher: e.target.value })} className="h-10" />
          </div>
          {!manualEntryMode && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">ISBN</label>
                <Input value={bookInfo.isbn || ""} onChange={(e) => setBookInfo({ ...bookInfo, isbn: e.target.value })} className="h-10 font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">바코드</label>
                <Input value={barcode} disabled className="h-10 font-mono text-xs" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">번역자</label>
            <Input value={bookInfo.translators || ""} onChange={(e) => setBookInfo({ ...bookInfo, translators: e.target.value })} className="h-10" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">출판일</label>
              <Input value={bookInfo.published_at || ""} onChange={(e) => setBookInfo({ ...bookInfo, published_at: e.target.value })} className="h-10" placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">카테고리</label>
              <Input value={bookInfo.category || ""} onChange={(e) => setBookInfo({ ...bookInfo, category: e.target.value })} className="h-10 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">정가</label>
              <Input type="number" value={bookInfo.price || 0} onChange={(e) => setBookInfo({ ...bookInfo, price: Number(e.target.value) })} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">판매가</label>
              <Input type="number" value={bookInfo.sale_price || 0} onChange={(e) => setBookInfo({ ...bookInfo, sale_price: Number(e.target.value) })} className="h-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">소개</label>
            <textarea
              value={bookInfo.description}
              onChange={(e) => setBookInfo({ ...bookInfo, description: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
              rows={3}
            />
          </div>

          <hr className="my-1" />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">서재 선택</label>
            <Select value={selectedShelf} onValueChange={(v) => setSelectedShelf(v ?? "")}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="서재를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {shelves.map((shelf) => (
                  <SelectItem key={shelf.id} value={shelf.name}>
                    {shelf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">위치 상세 (선택)</label>
            <Input
              placeholder="예: A-3, 상단 2번째"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">개별 대여 기간 (선택)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={90}
                placeholder="기본값 사용"
                value={rentalDays}
                onChange={(e) => setRentalDays(e.target.value)}
                className="h-12 w-32"
              />
              <span className="text-sm text-muted-foreground">일</span>
            </div>
          </div>
        </div>

        {/* Spacer for floating button */}
        <div className="h-20" />

        {/* Floating register button */}
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <Button
            size="lg"
            className="w-full h-14 text-lg shadow-lg"
            onClick={handleRegister}
            disabled={isRegistering || !selectedShelf || ((duplicateDetected || manualEntryMode) && !customBarcode.trim()) || !bookInfo?.title.trim()}
          >
            {isRegistering ? (
              <Loader2 className="size-5 mr-2 animate-spin" />
            ) : (
              <BookPlus className="size-5 mr-2" />
            )}
            {duplicateDetected ? "자체 바코드로 등록" : manualEntryMode ? "수동 등록" : "도서 등록"}
          </Button>
        </div>
      </div>
    );
  }

  // Default: Start screen
  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-8">
      <h1 className="text-xl font-bold">도서 등록</h1>

      {error && (
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
          {barcode && (
            <button
              onClick={() => {
                setManualEntryMode(true);
                setBookInfo({
                  title: "",
                  author: "",
                  publisher: "",
                  cover_image: "",
                  isbn: barcode,
                  description: "",
                });
                setCustomBarcode(barcode);
                setError("");
                setDuplicateDetected(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer py-4"
            >
              <Pencil className="size-5 text-primary" />
              <span className="text-sm font-medium text-primary">
                이 바코드로 수동 입력하기
              </span>
            </button>
          )}
        </div>
      )}

      {searching && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">도서 정보 검색 중...</p>
        </div>
      )}

      {!searching && (
        <>
          <button
            onClick={startScanning}
            className="w-full max-w-sm flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
            style={{ minHeight: 200 }}
          >
            <Camera className="size-12 text-primary" />
            <span className="text-lg font-semibold text-primary">
              바코드 스캔
            </span>
            <span className="text-xs text-muted-foreground">
              터치하여 카메라를 열고 바코드를 스캔하세요
            </span>
          </button>

          <div className="w-full max-w-sm flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">또는</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="w-full max-w-sm space-y-2">
            <label className="text-sm font-medium">ISBN 직접 입력</label>
            <div className="flex gap-2">
              <Input
                placeholder="ISBN 번호 입력"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                className="h-12 flex-1"
                inputMode="numeric"
              />
              <Button
                className="h-12 px-6"
                onClick={handleManualSearch}
                disabled={!manualBarcode.trim()}
              >
                검색
              </Button>
            </div>
          </div>

          <div className="w-full max-w-sm flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">또는</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={startManualEntry}
            className="w-full max-w-sm flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer py-4"
          >
            <Pencil className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              ISBN 없이 수동 입력
            </span>
          </button>
        </>
      )}
    </div>
  );
}
