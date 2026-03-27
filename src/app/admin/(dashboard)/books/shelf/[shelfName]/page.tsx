"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle,
  CheckCircle2,
  BookPlus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Camera,
  X,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { getShelfBooks } from "@/app/actions/shelves";
import { createBook, updateBook, deleteBook, checkBarcodeExists, getBookRentalCount } from "@/app/actions/books";
import { uploadBookCoverImage } from "@/lib/storage";

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

type ShelfBook = {
  id: string;
  title: string;
  author: string;
  barcode: string;
  location_detail: string;
  location_group: string;
  cover_image: string | null;
  is_available: boolean;
  publisher: string | null;
  description: string | null;
};

const PAGE_SIZE = 15;

export default function ShelfBooksPage() {
  const params = useParams();
  const shelfName = decodeURIComponent(params.shelfName as string);

  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [isLoading, startTransition] = useTransition();

  // Search / pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Book registration
  const [barcode, setBarcode] = useState("");
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [locationDetail, setLocationDetail] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [isSearchingBook, startSearchBook] = useTransition();
  const [isRegistering, startRegister] = useTransition();

  const [rentalDays, setRentalDays] = useState("");

  // Hybrid barcode
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [customBarcode, setCustomBarcode] = useState("");

  // Manual entry mode (ISBN 없는 도서)
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Image upload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile scanner
  const [scanning, setScanning] = useState(false);
  const [mobileSearching, setMobileSearching] = useState(false);
  const scannerRef = useRef<unknown>(null);

  // Edit dialog
  const [editBook, setEditBook] = useState<ShelfBook | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, startSave] = useTransition();
  const [isEditUploading, setIsEditUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ShelfBook | null>(null);
  const [deleteRentalInfo, setDeleteRentalInfo] = useState<{ total: number; active: number } | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isCheckingDelete, startCheckDelete] = useTransition();

  const loadBooks = useCallback(() => {
    startTransition(async () => {
      const data = await getShelfBooks(shelfName);
      setBooks(data as ShelfBook[]);
    });
  }, [shelfName]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Filtered + paginated
  const filtered = books.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // --- Shared book search by ISBN ---
  async function searchByBarcode(isbn: string) {
    setRegError("");
    setRegSuccess(false);
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
        setRegError(data.error || "도서 정보를 찾을 수 없습니다.");
        setBarcode(isbn);
        return;
      }
      setBookInfo(data);
      setBarcode(isbn);
    } catch {
      setRegError("도서 검색 중 오류가 발생했습니다.");
    }
  }

  // --- Desktop book search ---
  function handleBookSearch() {
    if (!barcode.trim()) return;
    setRegError("");
    setRegSuccess(false);
    startSearchBook(async () => {
      await searchByBarcode(barcode.trim());
    });
  }

  // --- Mobile scanner ---
  async function startScanning() {
    setScanning(true);
    setRegError("");
    setBookInfo(null);
    setRegSuccess(false);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("shelf-barcode-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText: string) => {
          html5QrCode.stop().then(() => {
            scannerRef.current = null;
            setScanning(false);
            setMobileSearching(true);
            searchByBarcode(decodedText).finally(() => setMobileSearching(false));
          });
        },
        () => {}
      );
    } catch {
      setRegError("카메라를 사용할 수 없습니다. 수동 입력을 이용해주세요.");
      setScanning(false);
    }
  }

  function stopScanning() {
    const scanner = scannerRef.current as { stop: () => Promise<void> } | null;
    if (scanner) {
      scanner.stop().then(() => { scannerRef.current = null; });
    }
    setScanning(false);
  }

  function handleMobileManualSearch() {
    if (!barcode.trim()) return;
    setMobileSearching(true);
    searchByBarcode(barcode.trim()).finally(() => setMobileSearching(false));
  }

  // --- Register ---
  function handleRegister() {
    if (!bookInfo) return;
    if (!bookInfo.title.trim()) {
      setRegError("도서명을 입력해주세요.");
      return;
    }
    const finalBarcode = manualEntryMode ? customBarcode.trim() : (duplicateDetected ? customBarcode.trim() : barcode.trim());
    if ((manualEntryMode || duplicateDetected) && !finalBarcode) return;
    setRegError("");
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
      formData.set("location_group", shelfName);
      formData.set("location_detail", locationDetail.trim());
      if (rentalDays.trim()) formData.set("rental_days", rentalDays.trim());

      const result = await createBook(formData);
      if (!result.success) {
        setRegError(result.error || "도서 등록에 실패했습니다.");
        return;
      }
      setRegSuccess(true);
      setBarcode("");
      setBookInfo(null);
      setLocationDetail("");
      setRentalDays("");
      setDuplicateDetected(false);
      setCustomBarcode("");
      loadBooks();
      setTimeout(() => setRegSuccess(false), 2000);
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
    setRegError("");
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
        setRegError("이미지 업로드에 실패했습니다.");
      }
    } catch {
      setRegError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function resetRegistration() {
    setBookInfo(null);
    setBarcode("");
    setLocationDetail("");
    setRentalDays("");
    setRegError("");
    setRegSuccess(false);
    setDuplicateDetected(false);
    setCustomBarcode("");
    setManualEntryMode(false);
  }

  // --- Edit ---
  function openEdit(book: ShelfBook) {
    setEditBook(book);
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditLocation(book.location_detail);
    setEditCoverImage(book.cover_image || "");
    setEditError("");
    setIsEditUploading(false);
  }

  async function handleEditImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsEditUploading(true);
    try {
      const url = await uploadBookCoverImage(file);
      if (url) {
        setEditCoverImage(url);
      } else {
        setEditError("이미지 업로드에 실패했습니다.");
      }
    } catch {
      setEditError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsEditUploading(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  }

  function handleEditSave() {
    if (!editBook || !editTitle.trim() || !editAuthor.trim()) return;
    startSave(async () => {
      const formData = new FormData();
      formData.set("title", editTitle.trim());
      formData.set("author", editAuthor.trim());
      formData.set("location_detail", editLocation.trim());
      formData.set("cover_image", editCoverImage);
      const result = await updateBook(editBook.id, formData);
      if (!result.success) {
        setEditError(result.error || "수정에 실패했습니다.");
        return;
      }
      setEditBook(null);
      loadBooks();
    });
  }

  // --- Delete ---
  function openDeleteConfirm(book: ShelfBook) {
    setDeleteTarget(book);
    setDeleteRentalInfo(null);
    startCheckDelete(async () => {
      const info = await getBookRentalCount(book.id);
      setDeleteRentalInfo(info);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startDelete(async () => {
      const result = await deleteBook(deleteTarget.id);
      if (result.success) {
        setDeleteTarget(null);
        setDeleteRentalInfo(null);
        loadBooks();
      } else {
        setRegError(result.error || "삭제에 실패했습니다.");
        setDeleteTarget(null);
        setDeleteRentalInfo(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/books/new">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            <span className="hidden md:inline">서재 관리</span>
          </Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold">{shelfName}</h1>
        <Badge variant="secondary">{books.length}권</Badge>
      </div>

      {/* ===== Mobile registration ===== */}
      <div className="md:hidden">
        {scanning ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">바코드 스캔</h2>
                <Button variant="ghost" size="sm" onClick={stopScanning}>
                  <X className="size-4 mr-1" />
                  취소
                </Button>
              </div>
              <div
                id="shelf-barcode-reader"
                className="w-full rounded-lg overflow-hidden bg-black"
                style={{ minHeight: 280 }}
              />
              <p className="text-xs text-center text-muted-foreground">
                책 뒷면의 바코드를 카메라에 비춰주세요
              </p>
            </CardContent>
          </Card>
        ) : mobileSearching ? (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">도서 정보 검색 중...</p>
            </CardContent>
          </Card>
        ) : bookInfo ? (
          <>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">도서 정보</h2>
                <Button variant="ghost" size="sm" onClick={resetRegistration}>
                  <RotateCcw className="size-4 mr-1" />
                  처음으로
                </Button>
              </div>

              {regError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle className="size-4 shrink-0" />
                  {regError}
                </div>
              )}
              {regSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 rounded-lg p-3">
                  <CheckCircle2 className="size-4 shrink-0" />
                  등록 완료!
                </div>
              )}

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
              <div className="flex flex-col items-center gap-2">
                {bookInfo.cover_image ? (
                  <div className="relative">
                    <img src={bookInfo.cover_image} alt={bookInfo.title} className="w-24 h-32 object-cover rounded shadow" />
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
              </div>

              <hr />

              <div className="space-y-1.5">
                <label className="text-sm font-medium">상세 위치</label>
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

            </CardContent>
          </Card>

          {/* Floating register button */}
          <div className="fixed bottom-4 left-4 right-4 z-40">
            <Button
              size="lg"
              className="w-full h-14 text-lg shadow-lg"
              onClick={handleRegister}
              disabled={isRegistering || ((duplicateDetected || manualEntryMode) && !customBarcode.trim()) || !bookInfo?.title.trim()}
            >
              {isRegistering ? (
                <Loader2 className="size-5 mr-2 animate-spin" />
              ) : (
                <BookPlus className="size-5 mr-2" />
              )}
              {duplicateDetected ? "자체 바코드로 등록" : manualEntryMode ? "수동 등록" : "도서 등록"}
            </Button>
          </div>
          {/* Spacer for floating button */}
          <div className="h-20" />
          </>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-4">
              {regError && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="size-4 shrink-0" />
                    {regError}
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
                        setRegError("");
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
              {regSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 rounded-lg p-3">
                  <CheckCircle2 className="size-4 shrink-0" />
                  등록 완료!
                </div>
              )}

              <button
                onClick={startScanning}
                className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                style={{ minHeight: 160 }}
              >
                <Camera className="size-10 text-primary" />
                <span className="text-base font-semibold text-primary">바코드 스캔으로 등록</span>
                <span className="text-xs text-muted-foreground">터치하여 카메라 열기</span>
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">또는</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">ISBN 직접 입력</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="ISBN 번호 입력"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMobileManualSearch()}
                    className="h-12 flex-1"
                    inputMode="numeric"
                  />
                  <Button className="h-12 px-6" onClick={handleMobileManualSearch} disabled={!barcode.trim()}>
                    검색
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">또는</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={startManualEntry}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer py-4"
              >
                <Pencil className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  ISBN 없이 수동 입력
                </span>
              </button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== Desktop registration ===== */}
      <Card className="hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">도서 등록</CardTitle>
        </CardHeader>
        <CardContent>
          {regSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 rounded-lg p-2 mb-3">
              <CheckCircle2 className="size-4 shrink-0" />
              등록 완료!
            </div>
          )}
          {regError && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-2">
                <AlertCircle className="size-4 shrink-0" />
                {regError}
              </div>
              {barcode && !bookInfo && (
                <Button
                  variant="outline"
                  size="sm"
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
                    setRegError("");
                    setDuplicateDetected(false);
                  }}
                >
                  <Pencil className="size-4 mr-1" />
                  이 바코드로 수동 입력하기
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 max-w-xs">
              <label className="text-sm font-medium mb-1 block">바코드/ISBN</label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="바코드 입력"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBookSearch()}
                />
                <Button
                  variant="outline"
                  onClick={handleBookSearch}
                  disabled={isSearchingBook || !barcode.trim()}
                >
                  {isSearchingBook ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>
            </div>
            <Button variant="outline" onClick={startManualEntry}>
              <Pencil className="size-4 mr-1" />
              ISBN 없이 수동 입력
            </Button>
          </div>

          {manualEntryMode && (
            <div className="flex items-start gap-2 mt-3 rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950 p-3">
              <BookPlus className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                수동 등록 모드: ISBN이 없는 도서입니다. 자체 바코드를 붙이고 번호를 입력해주세요.
              </p>
            </div>
          )}

          {duplicateDetected && bookInfo && (
            <div className="flex items-start gap-2 mt-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-3">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                이미 등록된 도서입니다: &laquo;{bookInfo.title}&raquo;. 복본인 경우 자체 바코드 스티커를 붙이고 입력해주세요.
              </p>
            </div>
          )}

          {bookInfo && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="flex gap-4">
                <div className="shrink-0 flex flex-col items-center gap-1">
                  {bookInfo.cover_image ? (
                    <div className="relative">
                      <img src={bookInfo.cover_image} alt={bookInfo.title} className="w-16 h-22 object-cover rounded shadow" />
                      <button
                        type="button"
                        className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5"
                        onClick={() => setBookInfo({ ...bookInfo, cover_image: "" })}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-16 h-22 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      {isUploading ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Camera className="size-4 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">표지</span>
                        </>
                      )}
                    </button>
                  )}
                  {bookInfo.cover_image && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-primary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      변경
                    </button>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">도서명</label>
                    <Input value={bookInfo.title} onChange={(e) => setBookInfo({ ...bookInfo, title: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">저자</label>
                    <Input value={bookInfo.author} onChange={(e) => setBookInfo({ ...bookInfo, author: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">출판사</label>
                    <Input value={bookInfo.publisher} onChange={(e) => setBookInfo({ ...bookInfo, publisher: e.target.value })} className="h-8 text-sm" />
                  </div>
                  {!manualEntryMode && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">ISBN</label>
                      <Input value={bookInfo.isbn || ""} onChange={(e) => setBookInfo({ ...bookInfo, isbn: e.target.value })} className="h-8 text-sm font-mono text-xs" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">번역자</label>
                    <Input value={bookInfo.translators || ""} onChange={(e) => setBookInfo({ ...bookInfo, translators: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">출판일</label>
                    <Input value={bookInfo.published_at || ""} onChange={(e) => setBookInfo({ ...bookInfo, published_at: e.target.value })} className="h-8 text-sm" placeholder="YYYY-MM-DD" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">카테고리</label>
                    <Input value={bookInfo.category || ""} onChange={(e) => setBookInfo({ ...bookInfo, category: e.target.value })} className="h-8 text-sm text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">정가</label>
                    <Input type="number" value={bookInfo.price || 0} onChange={(e) => setBookInfo({ ...bookInfo, price: Number(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">판매가</label>
                    <Input type="number" value={bookInfo.sale_price || 0} onChange={(e) => setBookInfo({ ...bookInfo, sale_price: Number(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">소개</label>
                    <textarea
                      value={bookInfo.description}
                      onChange={(e) => setBookInfo({ ...bookInfo, description: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm min-h-[60px] resize-y"
                      rows={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <hr className="my-1" />
                  </div>
                  {manualEntryMode && (
                    <div>
                      <label className="text-xs font-semibold text-blue-600">자체 바코드 *</label>
                      <Input placeholder="자체 바코드" value={customBarcode} onChange={(e) => setCustomBarcode(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                  {duplicateDetected && (
                    <div>
                      <label className="text-xs font-semibold text-amber-600">자체 바코드</label>
                      <Input placeholder="자체 바코드" value={customBarcode} onChange={(e) => setCustomBarcode(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-primary">상세 위치</label>
                    <Input placeholder="예: A-3" value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold">대여 기간</label>
                    <div className="flex items-center gap-1">
                      <Input type="number" min={1} max={90} placeholder="기본값" value={rentalDays} onChange={(e) => setRentalDays(e.target.value)} className="h-8 text-sm w-20" />
                      <span className="text-xs text-muted-foreground">일</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={resetRegistration}>취소</Button>
                <Button size="sm" onClick={handleRegister} disabled={isRegistering || ((duplicateDetected || manualEntryMode) && !customBarcode.trim()) || !bookInfo?.title.trim()}>
                  {isRegistering ? <Loader2 className="size-4 mr-1 animate-spin" /> : <BookPlus className="size-4 mr-1" />}
                  {duplicateDetected ? "복본 등록" : manualEntryMode ? "수동 등록" : "등록"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Book list ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">도서 목록</CardTitle>
            <div className="w-48 md:w-64">
              <Input
                placeholder="제목 또는 저자 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? "검색 결과가 없습니다." : "등록된 도서가 없습니다."}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium w-12"></th>
                      <th className="text-left p-3 font-medium">제목</th>
                      <th className="text-left p-3 font-medium w-32">저자</th>
                      <th className="text-left p-3 font-medium w-32">바코드</th>
                      <th className="text-left p-3 font-medium w-20">위치</th>
                      <th className="text-left p-3 font-medium w-20">상태</th>
                      <th className="text-left p-3 font-medium w-20">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((book) => (
                      <tr
                        key={book.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => openEdit(book)}
                      >
                        <td className="p-3">
                          {book.cover_image ? (
                            <img src={book.cover_image} alt="" className="w-8 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-8 h-10 bg-muted rounded" />
                          )}
                        </td>
                        <td className="p-3 font-medium truncate max-w-[200px]">{book.title}</td>
                        <td className="p-3 text-muted-foreground truncate">{book.author}</td>
                        <td className="p-3 text-muted-foreground font-mono text-xs">{book.barcode}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{book.location_detail}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={book.is_available ? "default" : "secondary"} className="text-xs">
                            {book.is_available ? "비치" : "대출중"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(book)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openDeleteConfirm(book)}>
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {paginated.map((book) => (
                  <div
                    key={book.id}
                    className="flex gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer"
                    onClick={() => openEdit(book)}
                  >
                    {book.cover_image ? (
                      <img src={book.cover_image} alt="" className="w-12 h-16 object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-12 h-16 bg-muted rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-tight line-clamp-2">{book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{book.location_detail}</Badge>
                        <Badge variant={book.is_available ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {book.is_available ? "비치" : "대출중"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(book)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openDeleteConfirm(book)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editBook} onOpenChange={(open) => { if (!open) setEditBook(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">도서 편집</DialogTitle>
          </DialogHeader>
          {editBook && (
            <div className="space-y-5 mt-2">
              {editError && (
                <div className="flex items-center gap-2 text-base text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle className="size-5 shrink-0" />
                  {editError}
                </div>
              )}
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditImageUpload}
              />
              <div className="flex gap-4 items-start">
                <div className="shrink-0 flex flex-col items-center gap-2">
                  {editCoverImage ? (
                    <div className="relative">
                      <img src={editCoverImage} alt="" className="w-20 h-28 object-cover rounded shadow" />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-background border rounded-full p-1"
                        onClick={() => setEditCoverImage("")}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isEditUploading}
                      className="w-20 h-28 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      {isEditUploading ? (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Camera className="size-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">표지 추가</span>
                        </>
                      )}
                    </button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-sm"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={isEditUploading}
                  >
                    {isEditUploading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Camera className="size-4 mr-1.5" />}
                    {editCoverImage ? "표지 변경" : "표지 업로드"}
                  </Button>
                </div>
                <div className="text-base text-muted-foreground space-y-1.5 pt-1">
                  <p>바코드: <span className="font-mono">{editBook.barcode}</span></p>
                  <p>서재: {shelfName}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium">제목</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium">저자</label>
                <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium">상세 위치</label>
                <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-12 text-base" />
              </div>
              <Button className="w-full h-14 text-lg" onClick={handleEditSave} disabled={isSaving || !editTitle.trim()}>
                {isSaving ? <Loader2 className="size-5 mr-2 animate-spin" /> : <CheckCircle2 className="size-5 mr-2" />}
                저장
              </Button>
              <Button
                variant="destructive"
                className="w-full h-14 text-lg"
                onClick={() => { openDeleteConfirm(editBook); setEditBook(null); }}
              >
                <Trash2 className="size-5 mr-2" />
                삭제
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteRentalInfo(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">도서 삭제</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-5 mt-2">
              {isCheckingDelete ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : deleteRentalInfo?.active ? (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-base text-destructive">
                      현재 대출 중인 도서는 삭제할 수 없습니다.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full h-14 text-lg" onClick={() => { setDeleteTarget(null); setDeleteRentalInfo(null); }}>닫기</Button>
                </>
              ) : (
                <>
                  <p className="text-lg text-muted-foreground">
                    &quot;{deleteTarget.title}&quot;을(를) 정말 삭제하시겠습니까?
                  </p>
                  {deleteRentalInfo && deleteRentalInfo.total > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-4">
                      <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-base text-amber-700 dark:text-amber-300">
                        이 도서는 총 {deleteRentalInfo.total}건의 대여 기록이 있습니다.
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-14 text-lg" onClick={() => { setDeleteTarget(null); setDeleteRentalInfo(null); }}>취소</Button>
                    <Button variant="destructive" className="flex-1 h-14 text-lg" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="size-5 mr-2 animate-spin" /> : <Trash2 className="size-5 mr-2" />}
                      삭제
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
