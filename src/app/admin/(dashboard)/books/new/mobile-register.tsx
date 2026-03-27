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
  Trash2,
  Flashlight,
  FlashlightOff,
  Copy,
  BookOpen,
} from "lucide-react";
import { getShelves } from "@/app/actions/shelves";
import { createBook, checkBarcodeExists, deleteBook } from "@/app/actions/books";
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

type PendingBook = {
  barcode: string;
  title: string;
  author: string;
  cover_image: string;
  data: BookInfo;
};

type RegisteredBook = {
  id: string;
  title: string;
  author: string;
  cover_image: string;
  barcode: string;
  shelf: string;
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
  const scannerRef = useRef<unknown>(null);

  const [rentalDays, setRentalDays] = useState("");

  // Hybrid barcode state
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [duplicateBookTitle, setDuplicateBookTitle] = useState("");
  const [customBarcode, setCustomBarcode] = useState("");

  // Manual entry mode (ISBN 없는 도서)
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Register mode: 'batch' | 'single' | 'duplicate'
  const [registerMode, setRegisterMode] = useState<"batch" | "single" | "duplicate">("batch");

  // Image upload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending books (scanned, not yet registered)
  const [pendingBooks, setPendingBooks] = useState<PendingBook[]>([]);
  const [scanSearching, setScanSearching] = useState(false);
  const [batchRegistering, setBatchRegistering] = useState(false);

  // Registered books history
  const [registeredBooks, setRegisteredBooks] = useState<RegisteredBook[]>([]);

  // Scan callback ref
  const onScanRef = useRef<(text: string) => void>(() => {});

  // Selected pending book for detail popup
  const [selectedPending, setSelectedPending] = useState<PendingBook | null>(null);

  // Torch
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Toast message
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2000);
  }

  const loadShelves = useCallback(async () => {
    const data = await getShelves();
    setShelves(
      (data as unknown as ShelfOption[]).filter((s) => s.type === "shelf")
    );
  }, []);

  useEffect(() => {
    loadShelves();
  }, [loadShelves]);

  // Handle browser back button: return to start screen instead of navigating away
  useEffect(() => {
    if (bookInfo || scanning) {
      window.history.pushState({ mobileRegister: true }, "");
      const handlePopState = () => {
        if (scanning) {
          stopScanning();
        }
        resetAll();
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!bookInfo, scanning]);

  async function searchByBarcode(isbn: string, forceMode?: "single" | "duplicate") {
    const mode = forceMode || registerMode;
    setSearching(true);
    setError("");
    setDuplicateDetected(false);
    setDuplicateBookTitle("");
    setCustomBarcode("");
    try {
      // In duplicate mode, always set duplicate detected
      if (mode === "duplicate") {
        const existing = await checkBarcodeExists(isbn);
        setDuplicateDetected(true);
        setDuplicateBookTitle(existing.book?.title || "");
      } else {
        // In single mode, check for duplicate
        const existing = await checkBarcodeExists(isbn);
        if (existing.exists && existing.book) {
          setDuplicateDetected(true);
          setDuplicateBookTitle(existing.book.title);
        }
      }

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

  async function initScanner() {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("barcode-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10 },
        (decodedText: string) => {
          html5QrCode.stop().then(() => {
            scannerRef.current = null;
            setTorchOn(false);
            onScanRef.current(decodedText);
          });
        },
        () => {}
      );

      // Check torch support
      try {
        const caps = html5QrCode.getRunningTrackCameraCapabilities() as unknown as { torchFeature?: { isSupported: () => boolean } };
        setTorchSupported(!!caps?.torchFeature?.isSupported());
      } catch {
        setTorchSupported(true);
      }
    } catch {
      setError("카메라를 사용할 수 없습니다. 수동 입력을 이용해주세요.");
      setScanning(false);
    }
  }

  async function toggleTorch() {
    const scanner = scannerRef.current as { getRunningTrackSettings: () => MediaTrackSettings; applyVideoConstraints: (c: MediaTrackConstraints) => Promise<void> } | null;
    if (!scanner) return;
    try {
      const newTorchState = !torchOn;
      await scanner.applyVideoConstraints({
        // @ts-expect-error torch is not in standard types
        advanced: [{ torch: newTorchState }],
      });
      setTorchOn(newTorchState);
    } catch {
      showToast("이 기기에서는 라이트를 지원하지 않습니다");
      setTorchSupported(false);
    }
  }

  async function startScanning(mode: "batch" | "single" | "duplicate" = "batch") {
    setRegisterMode(mode);
    setScanning(true);
    setError("");
    setBookInfo(null);
    setDuplicateDetected(false);
    setScanSearching(false);
    await initScanner();
  }

  // Single/duplicate scan: scan one barcode → show form
  async function handleSingleScan(isbn: string) {
    setScanSearching(true);
    try {
      const res = await fetch(`/api/books/search?isbn=${encodeURIComponent(isbn)}`);
      const data = await res.json();

      setScanSearching(false);
      setScanning(false);

      if (!res.ok || !data.title) {
        setError(data.error || "도서 정보를 찾을 수 없습니다.");
        setBarcode(isbn);
        return;
      }

      setBookInfo(data);
      setBarcode(isbn);

      if (registerMode === "duplicate") {
        const existing = await checkBarcodeExists(isbn);
        setDuplicateDetected(true);
        setDuplicateBookTitle(existing.book?.title || "");
      } else {
        const existing = await checkBarcodeExists(isbn);
        if (existing.exists && existing.book) {
          setDuplicateDetected(true);
          setDuplicateBookTitle(existing.book.title);
        }
      }
    } catch {
      setScanSearching(false);
      setScanning(false);
      setError("처리 중 오류가 발생했습니다.");
    }
  }

  async function handleScanAndCollect(isbn: string) {
    // Skip if already in pending or registered
    const inPending = pendingBooks.find((b) => b.barcode === isbn);
    const inRegistered = registeredBooks.find((b) => b.barcode === isbn);
    if (inPending || inRegistered) {
      showToast(`"${inPending?.title || inRegistered?.title}" 이미 등록된 도서입니다`);
      await initScanner();
      return;
    }

    setScanSearching(true);
    try {
      // Check duplicate in DB → toast and continue scanning
      const existing = await checkBarcodeExists(isbn);
      if (existing.exists) {
        setScanSearching(false);
        showToast(`"${existing.book?.title || isbn}" 이미 등록된 도서입니다.\n단일 도서 등록을 이용해주세요.`);
        await initScanner();
        return;
      }

      // Search Kakao API
      const res = await fetch(`/api/books/search?isbn=${encodeURIComponent(isbn)}`);
      const data = await res.json();
      if (!res.ok || !data.title) {
        setScanSearching(false);
        setScanning(false);
        setError(data.error || "도서 정보를 찾을 수 없습니다.");
        setBarcode(isbn);
        return;
      }

      // Add to pending
      setPendingBooks((prev) =>
        [
          ...prev,
          {
            barcode: isbn,
            title: data.title,
            author: data.author || "",
            cover_image: data.cover_image || "",
            data: data,
          },
        ].slice(0, 20)
      );

      setScanSearching(false);
      await initScanner();
    } catch {
      setScanSearching(false);
      setScanning(false);
      setError("처리 중 오류가 발생했습니다.");
    }
  }

  onScanRef.current = registerMode === "batch" ? handleScanAndCollect : handleSingleScan;

  async function handleBatchRegister() {
    if (pendingBooks.length === 0) return;

    // Stop scanner if running
    const scanner = scannerRef.current as { stop: () => Promise<void> } | null;
    if (scanner) {
      try { await scanner.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }

    setBatchRegistering(true);
    const results: RegisteredBook[] = [];
    const errors: string[] = [];

    for (const book of pendingBooks) {
      const formData = new FormData();
      formData.set("barcode", book.barcode);
      formData.set("title", book.data.title);
      formData.set("author", book.data.author);
      formData.set("publisher", book.data.publisher);
      formData.set("cover_image", book.data.cover_image);
      formData.set("description", book.data.description);
      formData.set("isbn", book.data.isbn || book.barcode);
      formData.set("translators", book.data.translators || "");
      formData.set("published_at", book.data.published_at || "");
      formData.set("price", String(book.data.price || 0));
      formData.set("sale_price", String(book.data.sale_price || 0));
      formData.set("category", book.data.category || "");
      formData.set("kakao_url", book.data.kakao_url || "");
      formData.set("sale_status", book.data.sale_status || "");
      formData.set("location_group", selectedShelf);
      formData.set("location_detail", locationDetail);

      const result = await createBook(formData);
      if (result.success && result.data) {
        results.push({
          id: result.data.id,
          title: book.title,
          author: book.author,
          cover_image: book.cover_image,
          barcode: book.barcode,
          shelf: selectedShelf,
        });
      } else {
        errors.push(`${book.title}: ${result.error || "등록 실패"}`);
      }
    }

    setRegisteredBooks((prev) => [...results, ...prev].slice(0, 20));
    setPendingBooks([]);
    setBatchRegistering(false);

    if (errors.length > 0) {
      setError(`${results.length}권 등록 완료, ${errors.length}권 실패`);
    } else {
      setError("");
    }

    // Exit scanning → go back to start screen
    setScanning(false);
    setTorchOn(false);
  }

  function stopScanning() {
    const scanner = scannerRef.current as { stop: () => Promise<void> } | null;
    if (scanner) {
      scanner.stop().then(() => {
        scannerRef.current = null;
      });
    }
    setScanning(false);
    setTorchOn(false);
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
      if (result.success && result.data) {
        setRegisteredBooks((prev) => [
          {
            id: result.data!.id,
            title: bookInfo.title,
            author: bookInfo.author,
            cover_image: bookInfo.cover_image,
            barcode: finalBarcode,
            shelf: selectedShelf,
          },
          ...prev,
        ]);
        resetForNext();
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

  function resetForNext() {
    setBookInfo(null);
    setBarcode("");
    setManualBarcode("");
    setError("");
    setDuplicateDetected(false);
    setDuplicateBookTitle("");
    setCustomBarcode("");
    setRentalDays("");
    setManualEntryMode(false);
  }

  function resetAll() {
    resetForNext();
    setRegisterMode("batch");
    setSelectedShelf("");
    setLocationDetail("");
  }

  // Scanning view
  if (scanning) {
    return (
      <div className="fixed inset-0 z-[150] flex flex-col bg-black">
        <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
          <h2 className="text-lg font-bold text-white">
            {registerMode === "batch" ? "바코드 스캔" : registerMode === "duplicate" ? "중복 도서 스캔" : "단일 도서 스캔"}
            {registerMode === "batch" && (pendingBooks.length > 0 || registeredBooks.length > 0) && (
              <span className="text-sm font-normal text-white/60 ml-2">
                {pendingBooks.length > 0 && `${pendingBooks.length}권 대기`}
                {pendingBooks.length > 0 && registeredBooks.length > 0 && " / "}
                {registeredBooks.length > 0 && `${registeredBooks.length}권 완료`}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {torchSupported && (
              <Button
                variant="ghost"
                size="sm"
                className={torchOn ? "text-yellow-400 hover:text-yellow-300" : "text-white hover:text-white/80"}
                onClick={toggleTorch}
              >
                {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-white hover:text-white/80" onClick={stopScanning}>
              <X className="size-5 mr-1" />
              취소
            </Button>
          </div>
        </div>

        {/* Loading overlay */}
        {(scanSearching || batchRegistering) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2 bg-black/70 rounded-xl px-6 py-4">
              <Loader2 className="size-8 animate-spin text-white" />
              <p className="text-white text-sm">
                {batchRegistering ? `일괄 등록 중...` : "검색 중..."}
              </p>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute top-16 left-4 right-4 z-30 flex justify-center">
            <div className="bg-white/90 dark:bg-zinc-800/90 text-foreground rounded-lg px-4 py-2.5 shadow-lg text-sm font-medium text-center max-w-xs">
              {toast.split("\n").map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </div>
          </div>
        )}

        <div
          id="barcode-reader"
          className="flex-1 w-full overflow-hidden"
        />

        {/* Bottom area */}
        <div className="bg-black/80 px-4 py-3 z-10 space-y-2">
          {registerMode === "batch" ? (
            <>
              {/* Pending books thumbnails */}
              {pendingBooks.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pendingBooks.map((book) => (
                    <button
                      key={book.barcode}
                      onClick={() => setSelectedPending(book)}
                      className="shrink-0 w-12 aspect-[3/4] rounded overflow-hidden border-2 border-amber-400 hover:border-amber-300 transition-colors"
                    >
                      {book.cover_image ? (
                        <img src={book.cover_image} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center">
                          <BookPlus className="size-4 text-white/50" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Batch register button */}
              {pendingBooks.length > 0 && (
                <Button
                  onClick={handleBatchRegister}
                  className="w-full h-12 text-base font-semibold"
                  disabled={batchRegistering || scanSearching}
                >
                  {batchRegistering ? (
                    <><Loader2 className="size-4 animate-spin mr-2" />등록 중...</>
                  ) : (
                    <>일괄 등록하기 ({pendingBooks.length}권)</>
                  )}
                </Button>
              )}

              {/* Previously registered (small, dimmed) */}
              {registeredBooks.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 opacity-50">
                  {registeredBooks.map((book) => (
                    <div key={book.id} className="shrink-0 w-10 aspect-[3/4] rounded overflow-hidden border border-green-500/50">
                      {book.cover_image ? (
                        <img src={book.cover_image} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center">
                          <CheckCircle2 className="size-3 text-green-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pendingBooks.length === 0 && registeredBooks.length === 0 && (
                <p className="text-sm text-center text-white/70">
                  책 뒷면의 바코드를 카메라에 비춰주세요
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-center text-white/70">
              {registerMode === "duplicate"
                ? "이미 등록된 도서의 바코드를 스캔하세요"
                : "등록할 도서의 바코드를 스캔하세요"}
            </p>
          )}
        </div>

        {/* Pending book detail popup */}
        {selectedPending && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setSelectedPending(null)}>
            <div className="bg-background rounded-xl shadow-xl p-5 mx-4 max-w-xs w-full space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                {selectedPending.cover_image ? (
                  <img src={selectedPending.cover_image} alt="" className="w-16 h-[5.5rem] object-cover rounded shadow shrink-0" />
                ) : (
                  <div className="w-16 h-[5.5rem] rounded bg-muted flex items-center justify-center shrink-0">
                    <BookPlus className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight">{selectedPending.title}</p>
                  {selectedPending.author && <p className="text-xs text-muted-foreground mt-1">{selectedPending.author}</p>}
                  <p className="text-xs text-muted-foreground mt-1">바코드: {selectedPending.barcode}</p>
                  {selectedPending.data.publisher && <p className="text-xs text-muted-foreground">출판사: {selectedPending.data.publisher}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setPendingBooks((prev) => prev.filter((b) => b.barcode !== selectedPending.barcode));
                    setSelectedPending(null);
                  }}
                >
                  <Trash2 className="size-4 mr-1" />
                  제거
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedPending(null)}
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Book info + registration form (fallback for duplicate/error)
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
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{duplicateBookTitle || "이 바코드"}</strong> 이미 등록됨 — 자체 바코드를 입력하세요
              </p>
            </div>
            <Input
              placeholder="자체 바코드 번호 입력"
              value={customBarcode}
              onChange={(e) => setCustomBarcode(e.target.value)}
              className="h-10"
            />
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

        {/* Spacer for floating button + registered bar */}
        <div className={registeredBooks.length > 0 ? "h-36" : "h-20"} />

        {/* Registered books bar */}
        {registeredBooks.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 z-30">
            <RegisteredBooksBar
              books={registeredBooks}
              onDelete={(id) => setRegisteredBooks((prev) => prev.filter((b) => b.id !== id))}
            />
          </div>
        )}

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

      {/* Step 1: 서재 선택 */}
      <div className="w-full max-w-sm space-y-2">
        <label className="text-sm font-medium">서재 선택 *</label>
        <Select value={selectedShelf} onValueChange={(v) => setSelectedShelf(v ?? "")}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="서재를 먼저 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {shelves.map((shelf) => (
              <SelectItem key={shelf.id} value={shelf.name}>
                {shelf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">위치 상세 (선택)</label>
          <Input
            placeholder="예: A-3, 상단 2번째"
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            className="h-12"
          />
        </div>
      </div>

      {/* Step 2: 스캔/입력 (서재 선택 후 활성화) */}
      {!selectedShelf ? (
        <div className="w-full max-w-sm flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 py-12">
          <Camera className="size-12 text-muted-foreground/30" />
          <span className="text-sm text-muted-foreground">
            서재를 선택하면 도서를 등록할 수 있습니다
          </span>
        </div>
      ) : (
        <>
          {error && (
            <div className="w-full max-w-sm space-y-3">
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
              {/* 연속 등록 (배치) */}
              <button
                onClick={() => startScanning("batch")}
                className="w-full max-w-sm flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                style={{ minHeight: 180 }}
              >
                <Camera className="size-12 text-primary" />
                <span className="text-lg font-semibold text-primary">
                  연속 등록 (바코드 스캔)
                </span>
                <span className="text-xs text-muted-foreground">
                  여러 권을 스캔하고 일괄 등록합니다
                </span>
              </button>

              <div className="w-full max-w-sm flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">또는</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* 단일 등록 + 중복 등록 */}
              <div className="w-full max-w-sm grid grid-cols-2 gap-3">
                <button
                  onClick={() => startScanning("single")}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer py-5"
                >
                  <BookOpen className="size-8 text-muted-foreground" />
                  <span className="text-sm font-semibold">단일 도서 등록</span>
                  <span className="text-[11px] text-muted-foreground text-center leading-tight px-2">
                    1권씩 상세 정보 확인 후 등록
                  </span>
                </button>
                <button
                  onClick={() => startScanning("duplicate")}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer py-5"
                >
                  <Copy className="size-8 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-semibold">중복 도서 등록</span>
                  <span className="text-[11px] text-muted-foreground text-center leading-tight px-2">
                    같은 책을 자체 바코드로 추가
                  </span>
                </button>
              </div>

              <div className="w-full max-w-sm flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">또는</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* ISBN 직접 입력 */}
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
        </>
      )}

      {registeredBooks.length > 0 && (
        <RegisteredBooksBar
          books={registeredBooks}
          onDelete={(id) => setRegisteredBooks((prev) => prev.filter((b) => b.id !== id))}
        />
      )}
    </div>
  );
}

function RegisteredBooksBar({
  books,
  onDelete,
}: {
  books: RegisteredBook[];
  onDelete: (id: string) => void;
}) {
  const [selectedBook, setSelectedBook] = useState<RegisteredBook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete(book: RegisteredBook) {
    setIsDeleting(true);
    const result = await deleteBook(book.id);
    setIsDeleting(false);
    if (result.success) {
      onDelete(book.id);
      setSelectedBook(null);
    }
  }

  return (
    <>
      <div className="w-full max-w-sm mx-auto mt-6">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="size-4 text-green-500" />
          <span className="text-sm font-medium text-muted-foreground">
            등록 완료 ({books.length}권)
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => setSelectedBook(book)}
              className="shrink-0 w-12 h-16 rounded border bg-muted/30 overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
            >
              {book.cover_image ? (
                <img src={book.cover_image} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookPlus className="size-4 text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Detail popup */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedBook(null)}>
          <div className="bg-background rounded-xl shadow-xl p-5 mx-4 max-w-xs w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {selectedBook.cover_image ? (
                <img src={selectedBook.cover_image} alt="" className="w-16 h-[5.5rem] object-cover rounded shadow shrink-0" />
              ) : (
                <div className="w-16 h-[5.5rem] rounded bg-muted flex items-center justify-center shrink-0">
                  <BookPlus className="size-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight">{selectedBook.title}</p>
                {selectedBook.author && <p className="text-xs text-muted-foreground mt-1">{selectedBook.author}</p>}
                <p className="text-xs text-muted-foreground mt-1">바코드: {selectedBook.barcode}</p>
                <p className="text-xs text-muted-foreground">서재: {selectedBook.shelf}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => handleDelete(selectedBook)}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />}
                삭제
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSelectedBook(null)}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
