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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ScanBarcode,
  Search,
  BookPlus,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { createBook } from "@/app/actions/books";

interface BookInfo {
  title: string;
  author: string;
  publisher: string;
  cover_image: string;
  isbn: string;
  description: string;
}

const LOCATION_GROUPS = [
  "어린이 코너",
  "청소년 코너",
  "일반 소설",
  "비소설/교양",
  "외국어",
  "잡지/신문",
];

const LOCATION_DETAILS = [
  "A-1", "A-2", "A-3",
  "B-1", "B-2", "B-3",
  "C-1", "C-2",
];

type Step = "scan" | "confirm" | "done";

export default function AdminBookNewPage() {
  const [barcode, setBarcode] = useState("");
  const [step, setStep] = useState<Step>("scan");
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [locationGroup, setLocationGroup] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [error, setError] = useState("");
  const [isSearching, startSearch] = useTransition();
  const [isRegistering, startRegister] = useTransition();

  const handleSearch = () => {
    if (!barcode.trim()) return;
    setError("");
    startSearch(async () => {
      try {
        const res = await fetch(`/api/books/search?isbn=${encodeURIComponent(barcode.trim())}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "도서 정보를 찾을 수 없습니다.");
          return;
        }
        setBookInfo(data);
        setStep("confirm");
      } catch {
        setError("도서 검색 중 오류가 발생했습니다.");
      }
    });
  };

  const handleRegister = () => {
    if (!bookInfo || !locationGroup || !locationDetail) return;
    setError("");
    startRegister(async () => {
      const formData = new FormData();
      formData.set("barcode", barcode.trim());
      formData.set("title", bookInfo.title);
      formData.set("author", bookInfo.author);
      formData.set("publisher", bookInfo.publisher);
      formData.set("cover_image", bookInfo.cover_image);
      formData.set("description", bookInfo.description);
      formData.set("location_group", locationGroup);
      formData.set("location_detail", locationDetail);

      const result = await createBook(formData);
      if (!result.success) {
        setError(result.error || "도서 등록에 실패했습니다.");
        return;
      }
      setStep("done");
    });
  };

  const handleReset = () => {
    setBarcode("");
    setBookInfo(null);
    setLocationGroup("");
    setLocationDetail("");
    setError("");
    setStep("scan");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">도서 등록</h1>

      {/* 바코드 스캔 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ISBN 바코드 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="바코드를 스캔하거나 직접 입력"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={step !== "scan"}
              autoFocus
            />
            <Button variant="outline" disabled={step !== "scan"}>
              <ScanBarcode className="size-4" />
            </Button>
          </div>
          <Button
            className="w-full"
            disabled={!barcode.trim() || step !== "scan" || isSearching}
            onClick={handleSearch}
          >
            {isSearching ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Search className="size-4 mr-2" />
            )}
            도서 정보 검색
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 도서 정보 확인 + 서가 위치 지정 */}
      {bookInfo && (step === "confirm" || step === "done") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">도서 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              {bookInfo.cover_image ? (
                <img
                  src={bookInfo.cover_image}
                  alt={bookInfo.title}
                  className="w-24 h-32 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-24 h-32 bg-muted rounded flex items-center justify-center shrink-0">
                  <BookPlus className="size-8 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-1 min-w-0">
                <h3 className="font-semibold text-lg">{bookInfo.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {bookInfo.author} · {bookInfo.publisher}
                </p>
                {bookInfo.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {bookInfo.description}
                  </p>
                )}
                <Badge variant="outline" className="mt-1">
                  ISBN: {barcode}
                </Badge>
              </div>
            </div>

            <hr />

            <div className="space-y-3">
              <p className="text-sm font-medium">서가 위치 지정</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    서가 그룹
                  </label>
                  <Select
                    value={locationGroup}
                    onValueChange={(v) => v && setLocationGroup(v)}
                    disabled={step === "done"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_GROUPS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    상세 위치
                  </label>
                  <Select
                    value={locationDetail}
                    onValueChange={(v) => v && setLocationDetail(v)}
                    disabled={step === "done"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_DETAILS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {step === "confirm" && (
              <Button
                className="w-full"
                disabled={!locationGroup || !locationDetail || isRegistering}
                onClick={handleRegister}
              >
                {isRegistering ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <BookPlus className="size-4 mr-2" />
                )}
                도서 등록
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 등록 완료 */}
      {step === "done" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-6 text-center space-y-3">
            <CheckCircle2 className="size-12 mx-auto text-green-600" />
            <p className="font-semibold text-lg">도서가 등록되었습니다!</p>
            <p className="text-sm text-muted-foreground">
              {locationGroup} &gt; {locationDetail}에 배치해주세요
            </p>
            <Button variant="outline" onClick={handleReset}>
              다음 도서 등록
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
