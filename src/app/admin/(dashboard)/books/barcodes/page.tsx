"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import JsBarcode from "jsbarcode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Barcode as BarcodeIcon, Printer, Plus, Trash2, Wand2, Loader2 } from "lucide-react";
import { generateBarcodes } from "@/app/actions/books";

function BarcodeSvg({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        fontSize: 13,
        margin: 2,
        displayValue: true,
      });
    } catch {
      // invalid value — ignore
    }
  }, [value]);
  return <svg ref={ref} className="max-w-full" />;
}

export default function BarcodesPage() {
  const [count, setCount] = useState("12");
  const [manual, setManual] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isGenerating, startGenerate] = useTransition();

  function generateAuto() {
    setError("");
    const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 200);
    startGenerate(async () => {
      const result = await generateBarcodes(n);
      if (result.success && result.data) {
        setCodes(result.data.codes);
      } else {
        setError(result.error ?? "번호 생성에 실패했습니다.");
      }
    });
  }

  function generateManual() {
    const list = manual
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    setCodes(list);
  }

  function clearAll() {
    setCodes([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarcodeIcon className="size-6" />
          자체 바코드 생성
        </h1>
        {codes.length > 0 && (
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" />
            인쇄
          </Button>
        )}
      </div>

      {/* 자동 생성 */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4" />
            자동 번호 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            기존에 등록된 자체 바코드와 겹치지 않는 새 번호를 자동으로 만들어 줍니다.
            (형식: BV000001)
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 w-40">
              <label className="text-sm font-medium">수량 (최대 200)</label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <Button onClick={generateAuto} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Plus className="size-4 mr-1" />
              )}
              없는 번호 자동 생성
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* 직접 입력 */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">직접 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="바코드 번호를 줄바꿈 또는 쉼표로 구분해 입력하세요"
            className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={generateManual}>
            <Plus className="size-4 mr-1" />
            목록 만들기
          </Button>
        </CardContent>
      </Card>

      {/* 미리보기 / 인쇄 영역 */}
      {codes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <p className="text-sm text-muted-foreground">{codes.length}개 바코드</p>
              <p className="text-xs text-muted-foreground">
                인쇄 시 5×3cm 크기로 출력됩니다. 테두리선을 따라 잘라 6×4cm 스티커에 붙이세요.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-4 mr-1" />
              비우기
            </Button>
          </div>
          <div className="barcode-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {codes.map((code, i) => (
              <div
                key={`${code}-${i}`}
                className="barcode-label flex flex-col items-center justify-center gap-2 rounded-lg border bg-white p-3"
                style={{ minHeight: "180px" }}
              >
                <img src="/logo.png" alt="" className="h-12 object-contain" />
                <BarcodeSvg value={code} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
