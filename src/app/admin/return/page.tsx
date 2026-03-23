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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScanBarcode,
  MapPin,
  CheckCircle2,
  Loader2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { returnBook } from "@/app/actions/rentals";

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
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleReturn = () => {
    if (!barcode.trim()) return;
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("barcode", barcode.trim());

      const res = await returnBook(formData);
      if (!res.success) {
        setError(res.error || "반납 처리에 실패했습니다.");
        return;
      }
      if (res.data) {
        setResult(res.data);
        setShowLocationDialog(true);
      }
    });
  };

  const handleReset = () => {
    setBarcode("");
    setResult(null);
    setShowLocationDialog(false);
    setError("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">반납 처리</h1>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 바코드 스캔 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">도서 바코드 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="반납할 도서 바코드 스캔"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReturn()}
              disabled={!!result}
              autoFocus
            />
            <Button
              variant="outline"
              disabled={!!result}
              onClick={handleReturn}
            >
              <ScanBarcode className="size-4" />
            </Button>
          </div>
          {!result && (
            <Button
              className="w-full"
              disabled={!barcode.trim() || isPending}
              onClick={handleReturn}
            >
              {isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4 mr-2" />
              )}
              반납 처리
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 반납 완료 */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-6 text-center space-y-3">
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
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowLocationDialog(true)}
              >
                <MapPin className="size-4 mr-2" />
                서가 위치 보기
              </Button>
              <Button variant="outline" onClick={handleReset}>
                다음 반납 처리
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 서가 위치 안내 다이얼로그 */}
      {result && (
        <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                서가 위치 안내
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                이 책을 아래 위치에 꽂아주세요
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="px-4 py-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">서가 그룹</p>
                  <p className="text-lg font-semibold">
                    {result.location_group}
                  </p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
                <div className="px-4 py-3 rounded-lg bg-primary/10 border-2 border-primary">
                  <p className="text-xs text-muted-foreground">상세 위치</p>
                  <p className="text-2xl font-bold text-primary">
                    {result.location_detail}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium">
                &laquo;{result.book.title}&raquo;
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
