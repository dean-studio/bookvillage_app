"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  BookOpen,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { getRecommendedBooks, logBookView } from "@/app/actions/recommendations";
import type { Book } from "@/types";

type RecommendedBook = { id: string; title: string; author: string; cover_image: string | null };

type BookDetail = Book & { avg_rating: number | null; review_count: number };

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

interface BookDetailClientProps {
  book: BookDetail;
  shelves: unknown[];
}

export function BookDetailClient({ book, shelves: rawShelves }: BookDetailClientProps) {
  const router = useRouter();
  const shelves = rawShelves as Shelf[];
  const [mapOpen, setMapOpen] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const [mapPos, setMapPos] = useState({ x: 0, y: 0 });
  const mapDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const [recommended, setRecommended] = useState<RecommendedBook[]>([]);

  // Log book view + fetch recommendations
  useEffect(() => {
    logBookView(book.id).catch(() => {});
    getRecommendedBooks(book.id).then((data) => setRecommended(data as RecommendedBook[])).catch(() => {});
  }, [book.id]);

  // SVG viewBox calculation
  const CELL = 60;
  const PAD = 10;
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  for (const s of shelves) {
    minX = Math.min(minX, s.position_x);
    minY = Math.min(minY, s.position_y);
    maxX = Math.max(maxX, s.position_x + s.width);
    maxY = Math.max(maxY, s.position_y + s.height);
  }
  const vbW = shelves.length > 0 ? (maxX - minX) * CELL + PAD * 2 : 0;
  const vbH = shelves.length > 0 ? (maxY - minY) * CELL + PAD * 2 : 0;

  const shelfSvgContent = shelves.length > 0 ? (
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
  ) : null;

  return (
    <div className="fixed inset-0 z-[150] bg-background flex flex-col h-dvh">
      {/* 상단 헤더 */}
      <header className="shrink-0 border-b bg-background px-4 py-3 flex items-center">
        <h1 className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-semibold truncate">
          도서 상세
        </h1>
      </header>

      {/* 스크롤 본문 */}
      <main className="flex-1 overflow-y-auto px-[clamp(1rem,3vw,2rem)] py-[2vh] space-y-[clamp(1rem,2vh,1.5rem)]">
        {/* 커버 이미지 */}
        {book.cover_image ? (
          <img
            src={book.cover_image}
            alt={book.title}
            className="w-full h-[clamp(12rem,30vh,20rem)] object-contain rounded bg-muted"
          />
        ) : (
          <div className="w-full h-[clamp(12rem,30vh,20rem)] bg-muted rounded flex items-center justify-center">
            <BookOpen className="size-[clamp(3rem,8vw,5rem)] text-muted-foreground" />
          </div>
        )}

        {/* 기본 정보 */}
        <div className="space-y-[clamp(0.5rem,1vh,0.8rem)]">
          <h2 className="text-[clamp(1.5rem,3.5vw,2.2rem)] font-bold leading-tight">
            {book.title}
          </h2>
          <p className="text-[clamp(1.1rem,2.5vw,1.6rem)] text-muted-foreground">
            {book.author}
          </p>
          {book.publisher && (
            <p className="text-[clamp(1rem,2.2vw,1.4rem)] text-muted-foreground">
              출판사: {book.publisher}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Badge
              variant={book.is_available ? "default" : "outline"}
              className={`text-[clamp(0.95rem,2.1vw,1.25rem)] px-3.5 py-1.5 ${!book.is_available ? "bg-black text-white border-black" : ""}`}
            >
              {book.is_available ? "대출 가능" : "대출 중"}
            </Badge>
          </div>
          {book.avg_rating !== null && (
            <p className="text-[clamp(1rem,2.2vw,1.4rem)]">
              {"★".repeat(Math.round(book.avg_rating))}{" "}
              <span className="text-muted-foreground">
                {book.avg_rating.toFixed(1)} ({book.review_count}개 리뷰)
              </span>
            </p>
          )}
        </div>

        {/* 설명 */}
        {book.description && (
          <p className="text-[clamp(0.95rem,2.1vw,1.3rem)] text-muted-foreground leading-relaxed">
            {book.description}
          </p>
        )}

        {/* 서가 위치 안내 - 대출 가능일 때만 표시 */}
        {book.is_available && <div className="rounded-lg border bg-muted/30 p-[clamp(1rem,2.5vw,1.5rem)]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="size-[clamp(1.1rem,2.5vw,1.5rem)] text-primary" />
            <span className="text-[clamp(1rem,2.2vw,1.4rem)] font-semibold">서가 위치</span>
          </div>
          <p className="text-[clamp(1.1rem,2.5vw,1.6rem)]">{book.location_group}</p>
          <p className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-primary mt-1">
            {book.location_detail}
          </p>

          {/* SVG 미니 서가 맵 */}
          {shelves.length > 0 && (
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

              {/* 확대 보기 오버레이 */}
              {mapOpen && (
                <div
                  className="fixed inset-0 z-[200] bg-white flex flex-col"
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
          )}
        </div>}

        {/* 추천 도서 */}
        {recommended.length > 0 && (
          <div className="space-y-[clamp(0.4rem,0.8vh,0.6rem)]">
            <div className="flex items-center gap-1.5">
              <BookOpen className="size-[clamp(1rem,2.2vw,1.3rem)] text-primary" />
              <span className="text-[clamp(1rem,2.2vw,1.4rem)] font-semibold">이 책을 본 사람이 본 도서</span>
            </div>
            <div className="overflow-x-auto flex gap-[clamp(0.5rem,1.5vw,0.8rem)] pb-2">
              {recommended.map((rb) => (
                <div
                  key={rb.id}
                  className="shrink-0 w-[clamp(7rem,18vw,10rem)] cursor-pointer active:scale-95 transition-transform"
                  onClick={() => router.push(`/books/${rb.id}`)}
                >
                  {rb.cover_image ? (
                    <img
                      src={rb.cover_image}
                      alt={rb.title}
                      className="w-full h-[clamp(9rem,24vw,13rem)] object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-[clamp(9rem,24vw,13rem)] bg-muted rounded flex items-center justify-center">
                      <BookOpen className="size-[clamp(1.5rem,4vw,2rem)] text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-[clamp(0.8rem,1.7vw,1rem)] font-medium mt-1 line-clamp-2 leading-tight">{rb.title}</p>
                  <p className="text-[clamp(0.7rem,1.5vw,0.85rem)] text-muted-foreground truncate">{rb.author}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 여백 (뒤로가기 버튼 영역 확보) */}
        <div className="h-4" />
      </main>

      {/* 하단 뒤로가기 버튼 */}
      <div className="shrink-0 border-t bg-background px-[clamp(1rem,3vw,2rem)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="outline"
          className="w-full h-[clamp(3.5rem,7vh,4.5rem)] text-[clamp(1.1rem,2.5vw,1.4rem)] font-semibold"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-[clamp(1.2rem,2.5vw,1.5rem)] mr-2" />
          뒤로 가기
        </Button>
      </div>
    </div>
  );
}
