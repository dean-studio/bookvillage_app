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
import { Megaphone, Plus, Loader2, Pencil, Trash2, X, Camera, ImageIcon } from "lucide-react";
import { getAllNotices, createNotice, updateNotice, deleteNotice, type Notice } from "@/app/actions/notices";
import { uploadNoticeImage } from "@/lib/storage";

const todayKST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const shortDate = (d: string) => { const [, m, day] = d.split("-"); return `${Number(m)}/${Number(day)}`; };

// 게시 기간 기준 상태 (기간이 없으면 표시 안 함)
function periodStatus(n: Notice): { label: string; className: string } | null {
  if (!n.starts_on && !n.ends_on) return null;
  const today = todayKST();
  const range = `${n.starts_on ? shortDate(n.starts_on) : ""} ~ ${n.ends_on ? shortDate(n.ends_on) : ""}`;
  if (n.starts_on && today < n.starts_on) return { label: `게시 예정 · ${range}`, className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
  if (n.ends_on && today > n.ends_on) return { label: `게시 끝 · ${range}`, className: "bg-muted text-muted-foreground" };
  return { label: `게시 중 · ${range}`, className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" };
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Notice | null>(null); // 수정 대상
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [isDeleting, startDelete] = useTransition();

  function load() {
    setLoading(true);
    getAllNotices().then((data) => { setNotices(data); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setTitle(""); setContent(""); setImageUrl(""); setStartsOn(""); setEndsOn(""); setError("");
    setDialogOpen(true);
  }
  function openEdit(n: Notice) {
    setEditing(n);
    setTitle(n.title); setContent(n.content); setImageUrl(n.image_url || ""); setStartsOn(n.starts_on || ""); setEndsOn(n.ends_on || ""); setError("");
    setDialogOpen(true);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadNoticeImage(file);
      if (url) setImageUrl(url);
      else setError("이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSave() {
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }
    if (startsOn && endsOn && endsOn < startsOn) { setError("종료일이 시작일보다 빠릅니다."); return; }
    setError("");
    startSave(async () => {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("content", content);
      fd.set("image_url", imageUrl);
      fd.set("starts_on", startsOn);
      fd.set("ends_on", endsOn);
      const result = editing ? await updateNotice(editing.id, fd) : await createNotice(fd);
      if (!result.success) { setError(result.error || "저장 실패"); return; }
      setDialogOpen(false);
      load();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startDelete(async () => {
      await deleteNotice(deleteTarget.id);
      setDeleteTarget(null);
      load();
    });
  }

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="size-6" />
          공지사항
        </h1>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1" />
          공지 작성
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">공지 목록 {notices.length > 0 && <span className="text-sm font-normal text-muted-foreground">({notices.length})</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : notices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">등록된 공지가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {notices.map((n) => (
                <div key={n.id} className="flex items-center gap-3 border rounded-lg p-3">
                  {n.image_url ? (
                    <img src={n.image_url} alt="" className="w-16 h-16 object-cover rounded shrink-0 bg-muted" />
                  ) : (
                    <div className="w-16 h-16 rounded shrink-0 bg-muted flex items-center justify-center"><ImageIcon className="size-5 text-muted-foreground/40" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-clamp-1">{n.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{n.content}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString("ko-KR")}</p>
                      {(() => {
                        const st = periodStatus(n);
                        return st && <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>;
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(n)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(n)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 작성/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing ? "공지 수정" : "공지 작성"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">제목 *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">내용</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="공지 내용" className="w-full min-h-32 rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">게시 기간 (선택)</label>
              <div className="flex items-center gap-2">
                <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="h-11 flex-1" aria-label="시작일" />
                <span className="text-muted-foreground">~</span>
                <Input type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} className="h-11 flex-1" aria-label="종료일" />
              </div>
              <p className="text-xs text-muted-foreground">
                이 기간에만 주민 화면(공지 목록·팝업)에 보여요. 두 날짜 모두 포함이고, 비워 두면 제한 없이 계속 보여요.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">이미지 (선택)</label>
              {imageUrl ? (
                <div className="relative w-full">
                  <img src={imageUrl} alt="" className="w-full max-h-60 object-contain rounded border bg-muted" />
                  <button type="button" className="absolute top-2 right-2 bg-background border rounded-full p-1" onClick={() => setImageUrl("")}>
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading}
                  className="w-full h-24 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  {isUploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (<><Camera className="size-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">이미지 추가 (최대 폭 1000px로 자동 조정)</span></>)}
                </button>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setDialogOpen(false)} disabled={isSaving}>취소</Button>
              <Button className="flex-1 h-11 font-semibold" onClick={handleSave} disabled={isSaving || !title.trim()}>
                {isSaving ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}{editing ? "수정" : "등록"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">공지 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">&quot;{deleteTarget?.title}&quot;을(를) 삭제하시겠습니까?</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>취소</Button>
            <Button variant="destructive" className="flex-1 h-11" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
