"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { getReceipts, type PurchaseReceipt } from "@/app/actions/receipts";
import { getPublicSettings } from "@/app/actions/settings";

function currentYearMonth(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ReceiptsPrint() {
  const params = useSearchParams();
  const month = params.get("month") || currentYearMonth();
  const onlyId = params.get("id"); // 특정 영수증 1장만 인쇄
  const [items, setItems] = useState<PurchaseReceipt[]>([]);
  const [libName, setLibName] = useState("자람도서관");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getReceipts(month), getPublicSettings()]).then(([data, settings]) => {
      setItems(onlyId ? data.filter((r) => r.id === onlyId) : data);
      if (settings.apartment_name) setLibName(settings.apartment_name);
      setLoading(false);
    });
  }, [month, onlyId]);

  const [y, m] = month.split("-");
  const monthNum = parseInt(m, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">
          영수증 인쇄 미리보기
          <span className="ml-2 text-base font-normal text-muted-foreground">
            (한 장에 한 영수증)
          </span>
        </h1>
        <Button onClick={() => window.print()} disabled={loading || items.length === 0}>
          <Printer className="size-4 mr-1" />
          인쇄
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-16 print:hidden">
          인쇄할 영수증이 없습니다.
        </p>
      ) : (
        <div className="receipt-print-root space-y-6 print:space-y-0">
          {items.map((it, idx) => (
            <div
              key={it.id}
              className="receipt-page mx-auto max-w-[210mm] bg-white p-8 print:p-0 shadow-sm print:shadow-none rounded-2xl print:rounded-none flex flex-col"
            >
              <header className="receipt-header flex items-baseline justify-between border-b-2 border-primary/70 pb-3 mb-5">
                <div>
                  <p className="text-xs tracking-[0.3em] uppercase text-primary font-bold">Purchase Receipt</p>
                  <h2 className="text-2xl print:text-[20pt] font-extrabold text-neutral-900">
                    {y}년 {monthNum}월 도서 구매 영수증
                  </h2>
                </div>
                <div className="text-right text-sm print:text-[9pt] text-neutral-400">
                  <p className="font-semibold text-neutral-600">{libName}</p>
                  <p>
                    {idx + 1} / {items.length}
                  </p>
                </div>
              </header>

              <div className="receipt-image flex-1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image_url} alt="" className="max-w-full max-h-full object-contain" />
              </div>

              {it.memo && (
                <p className="receipt-memo mt-4 text-center text-sm print:text-[9pt] text-neutral-500">
                  {it.memo}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReceiptsPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <ReceiptsPrint />
    </Suspense>
  );
}
