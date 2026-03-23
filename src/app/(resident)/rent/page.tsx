"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CameraOff,
  X,
  BookOpen,
  MapPin,
  ScanBarcode,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Settings,
  ArrowLeft,
  Candy,
  TrendingUp,
} from "lucide-react";
import { lookupBookByBarcode, selfCheckout } from "@/app/actions/rentals";
import { getShelves } from "@/app/actions/shelves";
import { getPopularSearches } from "@/app/actions/recommendations";
import { getPublicSettings } from "@/app/actions/settings";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type PopularSearch = { query: string; count: number };

type Shelf = {
  id: string;
  name: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  color: string;
  type: "shelf" | "label";
  font_size: number;
  font_bold: boolean;
};

function getShelfDisplayName(name: string, type: string): string {
  if (type === "label" && name.startsWith("icon:")) {
    const parts = name.split(":");
    return parts.slice(2).join(":") || "";
  }
  return name;
}

interface BookResult {
  id: string;
  title: string;
  author: string;
  cover_image: string | null;
  barcode: string;
  is_available: boolean;
  location_group: string;
  location_detail: string;
  publisher: string;
  due_date: string | null;
}

export default function RentPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [book, setBook] = useState<BookResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, startTransition] = useTransition();
  const scannerRef = useRef<unknown>(null);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const [mapPos, setMapPos] = useState({ x: 0, y: 0 });
  const mapDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"idle" | "guide" | "processing" | "done" | "error">("idle");
  const [checkoutResult, setCheckoutResult] = useState<{ book_title: string; due_date: string } | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [rollingIdx, setRollingIdx] = useState(0);

  const { data: popularSearches = [] } = useQuery<PopularSearch[]>({
    queryKey: ["popularSearches"],
    queryFn: () => getPopularSearches() as Promise<PopularSearch[]>,
  });

  const { data: publicSettings } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => getPublicSettings(),
  });

  useEffect(() => {
    getShelves().then((data) => setShelves(data as unknown as Shelf[]));
  }, []);

  // 인기 검색어 롤링
  useEffect(() => {
    if (popularSearches.length <= 1) return;
    const timer = setInterval(() => {
      setRollingIdx((i) => (i + 1) % popularSearches.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [popularSearches.length]);

  function handleLookup(barcodeValue?: string) {
    const code = barcodeValue || barcode.trim();
    if (!code) return;
    setError("");
    setBook(null);
    startTransition(async () => {
      const result = await lookupBookByBarcode(code);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBook(result.data as BookResult);
    });
  }

  async function startScanning() {
    setScanning(true);
    setError("");
    setBook(null);
    setCameraBlocked(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("rent-barcode-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 120 } },
        (decodedText: string) => {
          html5QrCode.stop().then(() => {
            scannerRef.current = null;
            setScanning(false);
            setBarcode(decodedText);
            handleLookup(decodedText);
          });
        },
        () => {}
      );
    } catch {
      setCameraBlocked(true);
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

  function handleReset() {
    setBook(null);
    setBarcode("");
    setError("");
    setMapOpen(false);
  }

  function openCheckoutPage() {
    setCheckoutStep("guide");
    setCheckoutResult(null);
    setCheckoutError("");
  }

  async function handleSelfCheckout() {
    if (!book) return;
    setCheckoutStep("processing");
    const result = await selfCheckout(book.barcode);
    if (result.success && result.data) {
      setCheckoutResult(result.data);
      setCheckoutStep("done");
    } else {
      setCheckoutError(result.error ?? "대출에 실패했습니다.");
      setCheckoutStep("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 헤더 */}
      <header className="shrink-0 border-b bg-background px-[clamp(1rem,3vw,2rem)] py-[1.5vh]">
        <div className="flex items-center gap-[clamp(0.5rem,1.5vw,0.8rem)]">
          {publicSettings?.logo_url ? (
            <img
              src={publicSettings.logo_url}
              alt="로고"
              className="size-[clamp(2rem,5vw,3rem)] rounded-lg object-contain shrink-0"
            />
          ) : (
            <div className="size-[clamp(2rem,5vw,3rem)] rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="size-[clamp(1.2rem,3vw,1.8rem)] text-primary" />
            </div>
          )}
          <div className="min-w-0">
            {publicSettings?.apartment_name && (
              <p className="text-[clamp(0.75rem,1.6vw,0.9rem)] text-muted-foreground font-medium leading-tight truncate">
                {publicSettings.apartment_name}
              </p>
            )}
            <h1 className="text-[clamp(1.3rem,3.5vw,2rem)] font-bold leading-tight">대여하기</h1>
          </div>
        </div>
      </header>

      {/* 바코드 스캔 풀스크린 페이지 */}
      {scanning && (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col h-dvh">
          {cameraBlocked ? (
            /* 카메라 권한 거부 가이드 */
            <div className="flex flex-1 flex-col items-center justify-center px-8 gap-6 bg-background">
              <div className="flex items-center justify-between w-full absolute top-0 left-0 px-4 py-3">
                <button onClick={() => { stopScanning(); setCameraBlocked(false); }} className="p-2 rounded-full hover:bg-muted">
                  <ArrowLeft className="size-6" />
                </button>
                <span className="text-[clamp(1rem,2.5vw,1.3rem)] font-semibold">카메라 접근</span>
                <div className="size-10" />
              </div>

              <CameraOff className="size-[clamp(4rem,10vw,6rem)] text-muted-foreground" />
              <h2 className="text-[clamp(1.3rem,3vw,1.8rem)] font-bold text-center">
                카메라 접근이 차단되었습니다
              </h2>
              <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground text-center leading-relaxed">
                바코드를 스캔하려면 카메라 권한이 필요합니다.
              </p>

              <div className="w-full max-w-sm bg-muted/50 rounded-2xl p-[clamp(1rem,2.5vw,1.5rem)] space-y-3">
                <p className="text-[clamp(1rem,2.2vw,1.2rem)] font-semibold flex items-center gap-2">
                  <Settings className="size-5" />
                  카메라 권한 허용 방법
                </p>
                <ol className="text-[clamp(0.9rem,2vw,1.1rem)] text-muted-foreground space-y-2 list-decimal pl-5">
                  <li>브라우저 <strong>주소창 왼쪽</strong>의 자물쇠/설정 아이콘을 터치</li>
                  <li><strong>카메라</strong> 항목을 찾아 <strong>허용</strong>으로 변경</li>
                  <li>페이지를 <strong>새로고침</strong> 후 다시 시도</li>
                </ol>
              </div>

              <div className="w-full max-w-sm space-y-3 mt-4">
                <Button
                  className="w-full h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] font-bold"
                  onClick={() => { setCameraBlocked(false); startScanning(); }}
                >
                  다시 시도
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-[clamp(3rem,6vh,4rem)] text-[clamp(1rem,2.2vw,1.3rem)]"
                  onClick={() => { stopScanning(); setCameraBlocked(false); }}
                >
                  바코드 직접 입력하기
                </Button>
              </div>
            </div>
          ) : (
            /* 카메라 스캔 화면 */
            <>
              {/* 상단 바 */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-black/80 z-10">
                <button onClick={() => { stopScanning(); }} className="p-2 rounded-full hover:bg-white/10">
                  <ArrowLeft className="size-6 text-white" />
                </button>
                <span className="text-[clamp(1rem,2.5vw,1.3rem)] font-semibold text-white">바코드 스캔</span>
                <div className="size-10" />
              </div>

              {/* 카메라 영역 - 화면 전체 */}
              <div className="flex-1 relative">
                <div
                  id="rent-barcode-reader"
                  className="absolute inset-0 w-full h-full"
                />
                {/* 가이드 오버레이 */}
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 pointer-events-none">
                  <p className="text-white text-[clamp(1rem,2.2vw,1.3rem)] bg-black/50 px-4 py-2 rounded-full">
                    책 뒷면의 바코드를 카메라에 비춰주세요
                  </p>
                </div>
              </div>

              {/* 하단 수동 입력 */}
              <div className="shrink-0 bg-black/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex gap-2">
                  <Input
                    placeholder="바코드 번호 직접 입력"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { stopScanning(); handleLookup(); } }}
                    className="h-[clamp(3rem,6vh,4rem)] text-[clamp(1rem,2.2vw,1.4rem)] bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                  <Button
                    onClick={() => { stopScanning(); handleLookup(); }}
                    disabled={!barcode.trim() || isLoading}
                    className="h-[clamp(3rem,6vh,4rem)] px-[clamp(1rem,3vw,1.5rem)]"
                  >
                    {isLoading ? (
                      <Loader2 className="size-[clamp(1.2rem,2.5vw,1.5rem)] animate-spin" />
                    ) : (
                      <ScanBarcode className="size-[clamp(1.2rem,2.5vw,1.5rem)]" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <main className={`flex-1 overflow-y-auto px-[clamp(1rem,3vw,2rem)] py-[2vh] ${book ? "space-y-[clamp(1rem,2vh,1.5rem)]" : "flex flex-col"}`}>
        {/* 메인 - 스캔 버튼 또는 도서 결과 */}
        {!book ? (
          <div className="flex-1 flex flex-col">
            {/* 인기 검색어 롤링 - 항상 공간 확보 */}
            <div className="flex items-center gap-[clamp(0.5rem,1.2vw,0.8rem)] rounded-lg bg-muted/50 px-[clamp(0.8rem,2vw,1.2rem)] py-[clamp(0.5rem,1vh,0.8rem)] mb-[1vh]">
              <TrendingUp className="size-[clamp(1rem,2.2vw,1.3rem)] text-primary shrink-0" />
              <span className="text-[clamp(0.85rem,1.8vw,1.05rem)] text-muted-foreground shrink-0">인기검색</span>
              <div className="relative h-[clamp(1.5rem,3vw,1.8rem)] overflow-hidden flex-1">
                {popularSearches.length === 0 ? (
                  <span className="absolute left-0 top-0 leading-[clamp(1.5rem,3vw,1.8rem)] text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground/50">
                    불러오는 중...
                  </span>
                ) : (
                  popularSearches.map((item, i) => (
                    <span
                      key={item.query}
                      className="absolute left-0 top-0 leading-[clamp(1.5rem,3vw,1.8rem)] text-[clamp(1rem,2.2vw,1.3rem)] font-semibold transition-all duration-500 ease-in-out whitespace-nowrap"
                      style={{
                        opacity: i === rollingIdx ? 1 : 0,
                        transform: i === rollingIdx ? "translateY(0)" : i < rollingIdx ? "translateY(-100%)" : "translateY(100%)",
                      }}
                    >
                      <span className="text-primary mr-1.5">{i + 1}.</span>
                      {item.query}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={startScanning}
                className="w-full max-w-md flex flex-col items-center justify-center gap-[1.5vh] rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all cursor-pointer py-[clamp(3rem,8vh,6rem)] px-6"
              >
                <Camera className="size-[clamp(4rem,10vw,6rem)] text-primary" />
                <span className="text-[clamp(1.4rem,3.5vw,2rem)] font-bold text-primary">
                  바코드 스캔
                </span>
                <span className="text-[clamp(0.95rem,2.2vw,1.2rem)] text-muted-foreground">
                  터치하여 카메라로 바코드를 스캔하세요
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {/* 에러 메시지 */}
        {error && !book && (
          <div className="flex items-center gap-2 text-[clamp(0.9rem,2vw,1.2rem)] text-destructive bg-destructive/10 rounded-lg p-[clamp(0.8rem,2vw,1.2rem)]">
            <AlertCircle className="size-[clamp(1rem,2.2vw,1.3rem)] shrink-0" />
            {error}
          </div>
        )}
        </main>

      {/* 로딩 모달 */}
      {isLoading && !scanning && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center">
          <div className="bg-background rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-xl">
            <Loader2 className="size-[clamp(2.5rem,6vw,3.5rem)] animate-spin text-primary" />
            <p className="text-[clamp(1rem,2.2vw,1.3rem)] font-medium">도서 조회 중...</p>
          </div>
        </div>
      )}

      {/* 도서 정보 결과 - 풀스크린 페이지 */}
      {book && (
        <div className="fixed inset-0 z-[150] bg-background flex flex-col h-dvh">
          {/* 상단 헤더 */}
          <header className="shrink-0 border-b bg-background px-4 py-3 flex items-center">
            <h1 className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-semibold truncate">
              도서 정보
            </h1>
          </header>

          <div className="flex-1 overflow-y-auto px-[clamp(1rem,3vw,2rem)] py-[2vh] space-y-[clamp(1rem,2vh,1.5rem)]">
            <Card>
              <CardContent className="p-[clamp(1rem,2.5vw,1.5rem)] space-y-[clamp(0.8rem,1.5vh,1.2rem)]">
                {/* 커버 + 기본 정보 */}
                <div className="flex gap-[clamp(0.8rem,2vw,1.2rem)]">
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.title}
                      className="w-[clamp(5rem,12vw,7rem)] h-[clamp(7rem,17vw,10rem)] object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-[clamp(5rem,12vw,7rem)] h-[clamp(7rem,17vw,10rem)] bg-muted rounded shrink-0 flex items-center justify-center">
                      <BookOpen className="size-[clamp(2rem,5vw,3rem)] text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-[0.5vh] min-w-0">
                    <p className="text-[clamp(1.2rem,2.8vw,1.8rem)] font-bold leading-tight">
                      {book.title}
                    </p>
                    <p className="text-[clamp(1rem,2.2vw,1.4rem)] text-muted-foreground">
                      {book.author}
                    </p>
                    {book.publisher && (
                      <p className="text-[clamp(0.85rem,1.8vw,1.1rem)] text-muted-foreground">
                        {book.publisher}
                      </p>
                    )}
                    <Badge
                      variant={book.is_available ? "default" : "outline"}
                      className={`w-fit text-[clamp(0.9rem,2vw,1.2rem)] px-3 py-1 mt-auto ${!book.is_available ? "bg-black text-white border-black" : ""}`}
                    >
                      {book.is_available ? (
                        <>
                          <CheckCircle2 className="size-[clamp(0.8rem,1.8vw,1rem)] mr-1" />
                          대출 가능
                        </>
                      ) : (
                        "대출 중"
                      )}
                    </Badge>
                    {!book.is_available && book.due_date && (
                      <p className="text-[clamp(0.85rem,1.8vw,1.1rem)] text-muted-foreground">
                        반납 예정: {new Date(book.due_date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    )}
                  </div>
                </div>

                {/* 서가 위치 */}
                <div className="rounded-lg border bg-muted/30 p-[clamp(0.8rem,2vw,1.2rem)]">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="size-[clamp(1.1rem,2.5vw,1.5rem)] text-primary" />
                    <span className="text-[clamp(1rem,2.2vw,1.4rem)] font-semibold">서가 위치</span>
                  </div>
                  <p className="text-[clamp(1rem,2.2vw,1.4rem)]">{book.location_group}</p>
                  <p className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-primary mt-0.5">
                    {book.location_detail}
                  </p>

                  {/* SVG 미니 서가 맵 */}
                  {shelves.length > 0 && (() => {
                    const CELL = 60;
                    const PAD = 10;
                    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
                    for (const s of shelves) {
                      minX = Math.min(minX, s.position_x);
                      minY = Math.min(minY, s.position_y);
                      maxX = Math.max(maxX, s.position_x + s.width);
                      maxY = Math.max(maxY, s.position_y + s.height);
                    }
                    const vbW = (maxX - minX) * CELL + PAD * 2;
                    const vbH = (maxY - minY) * CELL + PAD * 2;

                    const shelfSvgContent = (
                      <>
                        <style>{`
                          @keyframes blink-shelf {
                            0%, 100% { opacity: 1; fill-opacity: 0.35; }
                            50% { opacity: 0.3; fill-opacity: 0.1; }
                          }
                          @keyframes blink-text {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.3; }
                          }
                        `}</style>
                        {shelves.map((s) => {
                          const isHighlighted = s.type === "shelf" && s.name === book.location_group;
                          const x = (s.position_x - minX) * CELL + PAD;
                          const y = (s.position_y - minY) * CELL + PAD;
                          const w = s.width * CELL - 4;
                          const h = s.height * CELL - 4;
                          const displayName = getShelfDisplayName(s.name, s.type);
                          const fontSize = s.font_size > 0 ? Math.min(s.font_size, h * 0.5) : Math.min(10, h * 0.4);

                          return (
                            <g key={s.id}>
                              <rect
                                x={x + 2}
                                y={y + 2}
                                width={w}
                                height={h}
                                rx={4}
                                fill={isHighlighted ? s.color + "40" : s.color + "15"}
                                stroke={s.color}
                                strokeWidth={isHighlighted ? 3 : 1}
                                strokeDasharray={s.type === "label" ? "4 2" : undefined}
                                opacity={isHighlighted ? 1 : 0.35}
                                style={isHighlighted ? { animation: "blink-shelf 0.8s ease-in-out infinite" } : undefined}
                              />
                              <text
                                x={x + 2 + w / 2}
                                y={y + 2 + h / 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={s.color}
                                fontSize={fontSize}
                                fontWeight={s.font_bold || isHighlighted ? "bold" : "normal"}
                                opacity={isHighlighted ? 1 : 0.5}
                                style={isHighlighted ? { animation: "blink-text 0.8s ease-in-out infinite" } : undefined}
                              >
                                {displayName}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );

                    return (
                      <>
                        <div
                          className="relative mt-3 cursor-pointer group"
                          onClick={() => { setMapOpen(true); setMapScale(1); setMapPos({ x: 0, y: 0 }); }}
                        >
                          <svg
                            viewBox={`0 0 ${vbW} ${vbH}`}
                            className="w-full max-h-[200px] rounded"
                            style={{ background: "hsl(var(--muted))" }}
                          >
                            {shelfSvgContent}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded">
                            <Maximize2 className="size-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
                          </div>
                          <p className="text-[clamp(0.75rem,1.5vw,0.9rem)] text-muted-foreground text-center mt-1">
                            터치하면 크게 볼 수 있어요
                          </p>
                        </div>

                        {mapOpen && (
                          <div
                            className="fixed inset-0 z-[100] bg-white flex flex-col"
                            onClick={(e) => { if (e.target === e.currentTarget) setMapOpen(false); }}
                          >
                            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                              <span className="font-semibold text-[clamp(1rem,2.5vw,1.3rem)]">
                                서가 위치 - {book.location_group}
                              </span>
                              <button onClick={() => setMapOpen(false)} className="p-2 rounded-full hover:bg-muted">
                                <X className="size-5" />
                              </button>
                            </div>

                            <div
                              className="flex-1 overflow-hidden touch-none"
                              onWheel={(e) => {
                                e.preventDefault();
                                setMapScale((prev) => Math.min(5, Math.max(0.5, prev + (e.deltaY > 0 ? -0.2 : 0.2))));
                              }}
                              onPointerDown={(e) => {
                                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                                mapDragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: mapPos.x, startPosY: mapPos.y };
                              }}
                              onPointerMove={(e) => {
                                if (!mapDragRef.current) return;
                                setMapPos({
                                  x: mapDragRef.current.startPosX + (e.clientX - mapDragRef.current.startX),
                                  y: mapDragRef.current.startPosY + (e.clientY - mapDragRef.current.startY),
                                });
                              }}
                              onPointerUp={() => { mapDragRef.current = null; }}
                              onTouchStart={(e) => {
                                if (e.touches.length === 2) {
                                  const dist = Math.hypot(
                                    e.touches[0].clientX - e.touches[1].clientX,
                                    e.touches[0].clientY - e.touches[1].clientY
                                  );
                                  (e.currentTarget as HTMLElement & { _pinchStart?: number; _pinchScale?: number })._pinchStart = dist;
                                  (e.currentTarget as HTMLElement & { _pinchScale?: number })._pinchScale = mapScale;
                                }
                              }}
                              onTouchMove={(e) => {
                                if (e.touches.length === 2) {
                                  const el = e.currentTarget as HTMLElement & { _pinchStart?: number; _pinchScale?: number };
                                  const dist = Math.hypot(
                                    e.touches[0].clientX - e.touches[1].clientX,
                                    e.touches[0].clientY - e.touches[1].clientY
                                  );
                                  if (el._pinchStart && el._pinchScale) {
                                    const newScale = el._pinchScale * (dist / el._pinchStart);
                                    setMapScale(Math.min(5, Math.max(0.5, newScale)));
                                  }
                                }
                              }}
                            >
                              <svg
                                viewBox={`0 0 ${vbW} ${vbH}`}
                                className="w-full h-full"
                                style={{
                                  background: "hsl(var(--muted))",
                                  transform: `translate(${mapPos.x}px, ${mapPos.y}px) scale(${mapScale})`,
                                  transformOrigin: "center center",
                                }}
                              >
                                {shelfSvgContent}
                              </svg>
                            </div>

                            <div className="flex items-center justify-center gap-4 px-4 py-3 border-t shrink-0">
                              <button
                                onClick={() => setMapScale((s) => Math.max(0.5, s - 0.3))}
                                className="p-2 rounded-full hover:bg-muted border"
                              >
                                <ZoomOut className="size-5" />
                              </button>
                              <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                                {Math.round(mapScale * 100)}%
                              </span>
                              <button
                                onClick={() => setMapScale((s) => Math.min(5, s + 0.3))}
                                className="p-2 rounded-full hover:bg-muted border"
                              >
                                <ZoomIn className="size-5" />
                              </button>
                              <button
                                onClick={() => { setMapScale(1); setMapPos({ x: 0, y: 0 }); }}
                                className="px-3 py-1.5 rounded-full hover:bg-muted border text-sm"
                              >
                                초기화
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <div className="h-4" />
          </div>

          {/* 하단 고정 버튼 */}
          <div className="shrink-0 border-t bg-background px-[clamp(1rem,3vw,2rem)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
            {book.is_available && (
              <Button
                className="w-full h-[clamp(4rem,8vh,5rem)] text-[clamp(1.3rem,3vw,1.8rem)] font-bold rounded-xl"
                onClick={openCheckoutPage}
              >
                <BookOpen className="size-[clamp(1.3rem,3vw,1.8rem)] mr-3" />
                이 책 대여하기
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] font-semibold"
              onClick={handleReset}
            >
              <ArrowLeft className="size-[clamp(1.2rem,2.5vw,1.5rem)] mr-2" />
              뒤로 가기
            </Button>
          </div>
        </div>
      )}

      {/* 하단 바코드 입력 - 네비바 바로 위 고정 */}
      {!book && !scanning && (
        <div className="shrink-0 border-t bg-background px-[clamp(1rem,3vw,2rem)] py-2.5 mb-[10px]">
          <div className="flex gap-2">
            <Input
              placeholder="바코드 번호 직접 입력"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              className="h-[clamp(3rem,6vh,4rem)] text-[clamp(1rem,2.2vw,1.4rem)]"
            />
            <Button
              onClick={() => handleLookup()}
              disabled={!barcode.trim() || isLoading}
              className="h-[clamp(3rem,6vh,4rem)] px-[clamp(1rem,3vw,1.5rem)]"
            >
              {isLoading ? (
                <Loader2 className="size-[clamp(1.2rem,2.5vw,1.5rem)] animate-spin" />
              ) : (
                <ScanBarcode className="size-[clamp(1.2rem,2.5vw,1.5rem)]" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 대여 풀스크린 페이지 */}
      {checkoutStep !== "idle" && (
        <div className="fixed inset-0 z-[200] bg-primary flex flex-col h-dvh">
          {checkoutStep === "guide" && (
            <div className="flex flex-1 flex-col px-[clamp(1.5rem,4vw,2.5rem)] py-[clamp(2rem,4vh,3rem)]">
              {/* 상단 닫기 */}
              <div className="flex justify-end shrink-0">
                <button
                  onClick={() => setCheckoutStep("idle")}
                  className="p-2 rounded-full hover:bg-primary-foreground/10"
                >
                  <X className="size-[clamp(1.5rem,3.5vw,2rem)] text-primary-foreground" />
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center gap-[clamp(1.5rem,3vh,2.5rem)]">
                <BookOpen className="size-[clamp(3rem,8vw,5rem)] text-primary-foreground" />
                <h2 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-primary-foreground text-center">
                  대여 주의사항
                </h2>

                <div className="w-full max-w-md bg-primary-foreground/15 rounded-2xl p-[clamp(1.2rem,3vw,2rem)] space-y-[clamp(0.6rem,1.2vh,1rem)]">
                  <ul className="text-[clamp(1rem,2.2vw,1.3rem)] text-primary-foreground space-y-[clamp(0.5rem,1vh,0.8rem)]">
                    <li className="flex gap-2">
                      <span className="shrink-0">1.</span>
                      <span>대여 기간은 <strong>14일</strong>이며, 기한 내 반납해 주세요.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0">2.</span>
                      <span>연체 시 추가 대출이 <strong>제한</strong>됩니다.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0">3.</span>
                      <span>책이 훼손되지 않도록 <strong>소중히</strong> 다뤄 주세요.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0">4.</span>
                      <span>분실 시 <strong>동일 도서로 변상</strong>해야 합니다.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0">5.</span>
                      <span>반납은 사서에게 직접 하시거나, 반납함에 넣어 주세요.</span>
                    </li>
                  </ul>
                </div>

                <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-primary-foreground/80 text-center">
                  위 주의사항에 동의하고 대여하시겠습니까?
                </p>
              </div>

              {/* 하단 버튼 */}
              <div className="shrink-0 flex gap-3 pb-[env(safe-area-inset-bottom)]">
                <Button
                  variant="outline"
                  className="flex-1 h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/30"
                  onClick={() => setCheckoutStep("idle")}
                >
                  취소
                </Button>
                <Button
                  className="flex-1 h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold"
                  onClick={handleSelfCheckout}
                >
                  대여하기
                </Button>
              </div>
            </div>
          )}

          {checkoutStep === "processing" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              <Loader2 className="size-[clamp(3rem,8vw,5rem)] animate-spin text-primary-foreground" />
              <p className="text-[clamp(1.2rem,3vw,1.6rem)] font-medium text-primary-foreground">
                대여 처리 중...
              </p>
            </div>
          )}

          {checkoutStep === "done" && checkoutResult && (
            <div className="flex flex-1 flex-col items-center justify-center px-[clamp(1.5rem,4vw,2.5rem)] gap-[clamp(1.5rem,3vh,2.5rem)]">
              <CheckCircle2 className="size-[clamp(4rem,10vw,6rem)] text-primary-foreground" />
              <div className="text-center space-y-[clamp(0.5rem,1vh,1rem)]">
                <h2 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-primary-foreground">
                  대여 완료!
                </h2>
                <p className="text-[clamp(1.2rem,2.8vw,1.6rem)] text-primary-foreground font-semibold">
                  {checkoutResult.book_title}
                </p>
                <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-primary-foreground/80">
                  반납 예정일: <strong className="text-primary-foreground">{checkoutResult.due_date}</strong>
                </p>
                <div className="flex items-center gap-2 bg-primary-foreground/20 rounded-full px-5 py-2 mt-1">
                  <Candy className="size-[clamp(1.2rem,2.8vw,1.5rem)] text-yellow-300" />
                  <span className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-bold text-yellow-300">
                    +5 젤리 획득!
                  </span>
                </div>
              </div>
              <Button
                className="w-full max-w-xs h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold mt-4"
                onClick={() => { handleReset(); setCheckoutStep("idle"); router.push("/rent"); }}
              >
                홈으로 이동
              </Button>
            </div>
          )}

          {checkoutStep === "error" && (
            <div className="flex flex-1 flex-col items-center justify-center px-[clamp(1.5rem,4vw,2.5rem)] gap-[clamp(1.5rem,3vh,2.5rem)]">
              <AlertCircle className="size-[clamp(4rem,10vw,6rem)] text-primary-foreground/80" />
              <div className="text-center space-y-[clamp(0.5rem,1vh,1rem)]">
                <h2 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-primary-foreground">
                  대여 실패
                </h2>
                <p className="text-[clamp(1rem,2.2vw,1.3rem)] text-primary-foreground/80">
                  {checkoutError}
                </p>
              </div>
              <Button
                className="w-full max-w-xs h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/30"
                onClick={() => setCheckoutStep("idle")}
              >
                돌아가기
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
