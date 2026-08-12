"use client";

import { useState, useTransition, useRef } from "react";
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
  ScanBarcode,
  MapPin,
  CheckCircle2,
  Loader2,
  ArrowRight,
  AlertCircle,
  Camera,
  X,
  Search,
} from "lucide-react";
import { returnBook, getActiveRentals } from "@/app/actions/rentals";

interface ReturnResult {
  book: { title: string; barcode: string };
  user: { name: string };
  location_group: string;
  location_detail: string;
  was_overdue: boolean;
  overdue_days: number;
}

export default function AdminReturnPage() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<unknown>(null);

  // 제목 검색 반납 state
  type ActiveRental = Awaited<ReturnType<typeof getActiveRentals>>[number];
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ActiveRental[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    setError("");
    startSearch(async () => {
      const data = await getActiveRentals({ query: q });
      setSearchResults(data);
      setSearched(true);
    });
  };

  const handleReturn = (barcodeValue?: string) => {
    const code = barcodeValue || barcode.trim();
    if (!code) return;
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("barcode", code);

      const res = await returnBook(formData);
      if (!res.success) {
        setError(res.error || "반납 처리에 실패했습니다.");
        return;
      }
      if (res.data) {
        setResult(res.data);
        setBarcode(code);
      }
    });
  };

  const handleReset = () => {
    setBarcode("");
    setResult(null);
    setError("");
    setSearchQuery("");
    setSearchResults([]);
    setSearched(false);
  };

  // --- Scanner ---
  async function startScanning() {
    setScanning(true);
    setError("");
    setResult(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("return-barcode-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText: string) => {
          html5QrCode.stop().then(() => {
            scannerRef.current = null;
            setScanning(false);
            handleReturn(decodedText);
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
      scanner.stop().then(() => { scannerRef.current = null; });
    }
    setScanning(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold">반납 처리</h1>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 바코드 스캔 */}
      {!result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">도서 바코드 스캔</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanning ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">바코드 스캔 중...</p>
                  <Button variant="ghost" size="sm" onClick={stopScanning}>
                    <X className="size-4 mr-1" />
                    취소
                  </Button>
                </div>
                <div
                  id="return-barcode-reader"
                  className="w-full rounded-lg overflow-hidden bg-black"
                  style={{ minHeight: 280 }}
                />
                <p className="text-xs text-center text-muted-foreground">
                  책 뒷면의 바코드를 카메라에 비춰주세요
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: large scan button */}
                <button
                  onClick={startScanning}
                  className="md:hidden w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                  style={{ minHeight: 160 }}
                >
                  <Camera className="size-10 text-primary" />
                  <span className="text-base font-semibold text-primary">바코드 스캔으로 반납</span>
                  <span className="text-xs text-muted-foreground">ISBN 또는 자체 바코드를 스캔하세요</span>
                </button>

                <div className="md:hidden flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">또는 수동 입력</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Desktop: large scan button */}
                <button
                  onClick={startScanning}
                  className="hidden md:flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                  style={{ minHeight: 140 }}
                >
                  <Camera className="size-10 text-primary" />
                  <span className="text-base font-semibold text-primary">카메라로 바코드 스캔</span>
                  <span className="text-xs text-muted-foreground">클릭하여 카메라를 열고 바코드를 스캔하세요</span>
                </button>

                <div className="hidden md:flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">또는 수동 입력</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="ISBN 또는 자체 바코드를 입력하세요"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReturn()}
                    autoFocus
                    className="h-12 md:h-10"
                  />
                  <Button
                    className="h-12 md:h-10 px-6"
                    disabled={!barcode.trim() || isPending}
                    onClick={() => handleReturn()}
                  >
                    {isPending ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4 mr-2" />
                    )}
                    반납
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 제목으로 검색해서 반납 */}
      {!result && !scanning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">제목으로 검색해서 반납</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="도서명 또는 대여자 이름으로 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-12 md:h-10 pl-10"
                />
              </div>
              <Button
                className="h-12 md:h-10 px-6"
                disabled={!searchQuery.trim() || isSearching}
                onClick={handleSearch}
              >
                {isSearching ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Search className="size-4 mr-2" />}
                검색
              </Button>
            </div>

            {searched && searchResults.length === 0 && !isSearching && (
              <p className="text-center text-muted-foreground py-6 text-sm">
                대여 중인 도서 중 검색 결과가 없습니다.
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 border rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.book.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {r.user.name} · {r.user.dong_ho} · <span className="font-mono">{r.book.barcode}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={isPending}
                      onClick={() => handleReturn(r.book.barcode)}
                    >
                      {isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                      반납
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 반납 완료 + 서가 위치 안내 (inline) */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-6 space-y-4">
            <div className="text-center space-y-3">
              <CheckCircle2 className="size-12 mx-auto text-green-600" />
              <p className="font-semibold text-lg">반납이 완료되었습니다!</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  &laquo;{result.book.title}&raquo; - {result.user.name}
                </p>
                {result.was_overdue && (
                  <Badge variant="destructive" className="mt-1">
                    {result.overdue_days}일 연체
                  </Badge>
                )}
              </div>
            </div>

            {/* 서가 위치 안내 (inline, always visible) */}
            <div className="rounded-lg border-2 border-primary/30 bg-background p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-4 text-primary" />
                서가 위치 안내
              </div>
              <p className="text-xs text-muted-foreground">이 책을 아래 위치에 꽂아주세요</p>
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="px-4 py-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">서가 그룹</p>
                  <p className="text-lg font-semibold">{result.location_group}</p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
                <div className="px-4 py-3 rounded-lg bg-primary/10 border-2 border-primary">
                  <p className="text-xs text-muted-foreground">상세 위치</p>
                  <p className="text-2xl font-bold text-primary">{result.location_detail}</p>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full h-12" onClick={() => { handleReset(); startScanning(); }}>
              다음 반납 처리 (카메라 열기)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
