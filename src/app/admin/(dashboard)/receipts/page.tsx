"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Receipt,
  Upload,
  Loader2,
  Trash2,
  Printer,
  Camera,
  Pencil,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getReceipts,
  getReceiptMonths,
  createReceipt,
  updateReceiptMemo,
  reorderReceipts,
  deleteReceipt,
  type PurchaseReceipt,
} from "@/app/actions/receipts";
import { uploadReceiptImage, uploadReceiptPdf } from "@/lib/storage";

function currentYearMonth(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

export default function AdminReceiptsPage() {
  const [month, setMonth] = useState(currentYearMonth());
  const [items, setItems] = useState<PurchaseReceipt[]>([]);
  const [months, setMonths] = useState<{ year_month: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // 메모 편집
  const [editId, setEditId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [isSaving, startSave] = useTransition();

  const [deleteTarget, setDeleteTarget] = useState<PurchaseReceipt | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const [isReordering, startReorder] = useTransition();

  // 순서 이동: idx 항목을 dir(-1=앞, +1=뒤)로 스왑
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    startReorder(async () => {
      const result = await reorderReceipts(next.map((it) => it.id));
      if (!result.success) loadItems(month);
    });
  }

  function loadItems(ym: string) {
    setLoading(true);
    getReceipts(ym).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }
  function loadMonths() {
    getReceiptMonths().then(setMonths);
  }

  useEffect(() => {
    loadItems(month);
    loadMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectMonth(ym: string) {
    setMonth(ym);
    loadItems(ym);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError("");
    setIsUploading(true);
    try {
      // 여러 장(이미지)·여러 페이지(PDF) 연속 업로드 지원
      for (const file of Array.from(files)) {
        const isPdf =
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        let urls: string[] = [];
        if (isPdf) {
          try {
            urls = await uploadReceiptPdf(file);
          } catch {
            urls = [];
          }
          if (urls.length === 0) {
            setUploadError("일부 PDF 처리에 실패했습니다.");
            continue;
          }
        } else {
          const url = await uploadReceiptImage(file);
          if (!url) {
            setUploadError("일부 파일 업로드에 실패했습니다.");
            continue;
          }
          urls = [url];
        }
        // PDF는 페이지별로 한 장씩 저장
        for (const url of urls) {
          const fd = new FormData();
          fd.set("year_month", month);
          fd.set("image_url", url);
          fd.set("memo", "");
          await createReceipt(fd);
        }
      }
      loadItems(month);
      loadMonths();
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function startEdit(it: PurchaseReceipt) {
    setEditId(it.id);
    setEditMemo(it.memo);
  }
  function saveEdit(id: string) {
    startSave(async () => {
      await updateReceiptMemo(id, editMemo);
      setEditId(null);
      loadItems(month);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startDelete(async () => {
      await deleteReceipt(deleteTarget.id);
      setDeleteTarget(null);
      loadItems(month);
      loadMonths();
    });
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="size-6" />
          구매 영수증
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={items.length === 0}
            onClick={() => window.open(`/admin/receipts/print?month=${month}`, "_blank", "noopener")}
          >
            <Printer className="size-4 mr-1" />
            인쇄
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
            영수증 업로드
          </Button>
        </div>
      </div>

      {/* 월 선택 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">업로드 월</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => e.target.value && selectMonth(e.target.value)}
                className="h-9 w-44"
              />
            </div>
          </div>
          {months.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {months.map((m) => (
                <Button
                  key={m.year_month}
                  variant={m.year_month === month ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => selectMonth(m.year_month)}
                >
                  {monthLabel(m.year_month)}
                  <span className="ml-1.5 opacity-80">{m.count}</span>
                </Button>
              ))}
            </div>
          )}
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {monthLabel(month)} 영수증{" "}
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({items.length}장)</span>
            )}
            {isReordering && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          {items.length > 1 && (
            <p className="text-xs text-muted-foreground">
              ◀ ▶ 버튼으로 순서를 바꿀 수 있어요. 이 순서가 인쇄물에 그대로 반영됩니다.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Camera className="size-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                이 달의 영수증을 업로드하세요 (이미지·PDF, 여러 장 선택 가능)
              </span>
              <span className="text-xs text-muted-foreground/70">
                PDF는 페이지별로 한 장씩 저장됩니다
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
              {items.map((it, idx) => (
                <div key={it.id} className="group flex flex-col">
                  {/* 영수증 이미지 */}
                  <div className="relative">
                    {/* 순서 배지 */}
                    <span className="absolute -top-2 -left-2 z-20 flex size-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-md ring-2 ring-background">
                      {idx + 1}
                    </span>
                    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5 shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.image_url} alt="" className="w-full h-52 object-contain" />
                    </div>

                    {/* hover 액션: 인쇄 / 삭제 */}
                    <div className="absolute top-1.5 right-1.5 z-20 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => window.open(`/admin/receipts/print?month=${month}&id=${it.id}`, "_blank", "noopener")}
                        className="icon-btn flex size-8 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-background hover:text-primary transition-colors"
                        title="인쇄"
                      >
                        <Printer className="size-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(it)}
                        className="icon-btn flex size-8 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-destructive hover:text-white transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* hover 순서 이동 */}
                    <div className="absolute inset-x-1.5 bottom-1.5 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0 || isReordering}
                        className="icon-btn flex-1 flex items-center justify-center h-8 rounded-lg bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-background disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="앞으로"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        onClick={() => move(idx, 1)}
                        disabled={idx === items.length - 1 || isReordering}
                        className="icon-btn flex-1 flex items-center justify-center h-8 rounded-lg bg-background/90 backdrop-blur shadow-md ring-1 ring-black/5 hover:bg-background disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="뒤로"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* 메모 */}
                  <div className="mt-2 px-0.5">
                    {editId === it.id ? (
                      <div className="flex gap-1">
                        <Input
                          value={editMemo}
                          onChange={(e) => setEditMemo(e.target.value)}
                          placeholder="메모"
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it.id); }}
                        />
                        <Button size="sm" className="h-8 px-2" onClick={() => saveEdit(it.id)} disabled={isSaving}>
                          <Check className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(it)}
                        className="w-full text-left text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-8"
                      >
                        <Pencil className="size-3 shrink-0" />
                        <span className="truncate">{it.memo || "메모 추가"}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">영수증 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">이 영수증을 삭제하시겠습니까?</p>
          {deleteTarget && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={deleteTarget.image_url} alt="" className="w-full max-h-48 object-contain rounded border bg-muted" />
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              취소
            </Button>
            <Button variant="destructive" className="flex-1 h-11" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
