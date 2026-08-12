"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sticker, Printer, Trash2, Plus } from "lucide-react";
import { getPublicSettings } from "@/app/actions/settings";

export default function LogoPrintPage() {
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  const [count, setCount] = useState("24");
  const [items, setItems] = useState(0);

  useEffect(() => {
    getPublicSettings().then((s) => {
      if (s.logo_url) setLogoUrl(s.logo_url);
    });
  }, []);

  function generate() {
    const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 500);
    setItems(n);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sticker className="size-6" />
          로고 인쇄
        </h1>
        {items > 0 && (
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" />
            인쇄
          </Button>
        )}
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">도서관 로고 스티커</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            책 앞면에 붙일 도서관 로고를 인쇄합니다. 인쇄 시 3×2cm(바코드와 동일 크기)로 출력되며,
            테두리선을 따라 잘라 사용하세요.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 w-40">
              <label className="text-sm font-medium">수량 (최대 500)</label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <Button onClick={generate}>
              <Plus className="size-4 mr-1" />
              생성
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">미리보기 로고:</span>
            <img src={logoUrl} alt="" className="h-10 object-contain" />
          </div>
        </CardContent>
      </Card>

      {items > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between print:hidden">
            <p className="text-sm text-muted-foreground">{items}개</p>
            <Button variant="ghost" size="sm" onClick={() => setItems(0)}>
              <Trash2 className="size-4 mr-1" />
              비우기
            </Button>
          </div>
          <div className="logo-print barcode-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:block">
            {Array.from({ length: items }).map((_, i) => (
              <div
                key={i}
                className="barcode-label flex flex-col items-center justify-center rounded-lg border bg-white p-2 print:rounded-none"
                style={{ minHeight: "120px" }}
              >
                <img src={logoUrl} alt="" className="w-[85%] h-[85%] object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
