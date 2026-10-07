"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FolderOpen, Upload, Download, Trash2, Loader2, FileText, FileSpreadsheet, FileImage, File as FileIcon, Pencil, Check, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAdminFiles,
  createAdminFileUpload,
  saveAdminFile,
  getAdminFileDownloadUrl,
  updateAdminFileMemo,
  deleteAdminFile,
} from "@/app/actions/admin-files";

type AdminFile = Awaited<ReturnType<typeof getAdminFiles>>[number];

const ACCEPT = ".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx"].includes(ext)) return <FileSpreadsheet className="size-5 text-green-600 shrink-0" />;
  if (["jpg", "jpeg", "png"].includes(ext)) return <FileImage className="size-5 text-purple-600 shrink-0" />;
  if (["pdf"].includes(ext)) return <FileText className="size-5 text-red-600 shrink-0" />;
  if (["hwp", "hwpx"].includes(ext)) return <FileText className="size-5 text-sky-600 shrink-0" />;
  if (["doc", "docx"].includes(ext)) return <FileText className="size-5 text-blue-700 shrink-0" />;
  return <FileIcon className="size-5 text-muted-foreground shrink-0" />;
}

export default function AdminFilesPage() {
  const [files, setFiles] = useState<AdminFile[] | null>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [memo, setMemo] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [inputKey, setInputKey] = useState(0);

  function reload() {
    getAdminFiles().then(setFiles);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleUpload() {
    if (picked.length === 0) return;
    setMessage(null);
    const supabase = createClient();
    let ok = 0;
    for (const [i, file] of picked.entries()) {
      setUploading(`${i + 1}/${picked.length} ${file.name}`);
      const prep = await createAdminFileUpload(file.name, file.size);
      if (!prep.success || !prep.data) {
        setMessage({ type: "error", text: `${file.name}: ${prep.error}` });
        continue;
      }
      const { error } = await supabase.storage
        .from("admin-files")
        .uploadToSignedUrl(prep.data.path, prep.data.token, file, { contentType: file.type || undefined });
      if (error) {
        setMessage({ type: "error", text: `${file.name}: 업로드에 실패했어요.` });
        continue;
      }
      const saved = await saveAdminFile({ path: prep.data.path, name: file.name, size: file.size, mime: file.type, memo });
      if (saved.success) ok++;
      else setMessage({ type: "error", text: `${file.name}: ${saved.error}` });
    }
    setUploading(null);
    if (ok > 0) {
      setMessage({ type: "ok", text: `${ok}개 파일을 올렸어요.` });
      setPicked([]);
      setMemo("");
      setInputKey((k) => k + 1); // 파일 선택칸 비우기
      reload();
    }
  }

  async function handleDownload(f: AdminFile) {
    setBusyId(f.id);
    const res = await getAdminFileDownloadUrl(f.id);
    setBusyId(null);
    if (res.success && res.data) window.location.assign(res.data.url);
    else setMessage({ type: "error", text: res.error ?? "내려받기에 실패했어요." });
  }

  async function handleDelete(f: AdminFile) {
    setBusyId(f.id);
    const res = await deleteAdminFile(f.id);
    setBusyId(null);
    setConfirmId(null);
    if (res.success) setFiles((prev) => (prev ?? []).filter((x) => x.id !== f.id));
    else setMessage({ type: "error", text: res.error ?? "삭제에 실패했어요." });
  }

  async function handleSaveMemo(f: AdminFile) {
    setBusyId(f.id);
    const res = await updateAdminFileMemo(f.id, editMemo);
    setBusyId(null);
    if (res.success) {
      setFiles((prev) => (prev ?? []).map((x) => (x.id === f.id ? { ...x, memo: editMemo.trim() || null } : x)));
      setEditId(null);
    } else setMessage({ type: "error", text: res.error ?? "메모 저장에 실패했어요." });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FolderOpen className="size-6" />
        자료실
      </h1>
      <p className="text-muted-foreground -mt-3">
        인쇄할 파일을 미리 올려 두고, 도서관 PC에서 내려받아 한글·PDF 프로그램으로 인쇄하세요.
      </p>

      {/* 올리기 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="size-4" />파일 올리기</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              setPicked(Array.from(e.dataTransfer.files));
            }}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
          >
            <Upload className="size-7 text-muted-foreground" />
            <span className="font-medium">파일을 끌어다 놓거나 눌러서 고르세요</span>
            <span className="text-sm text-muted-foreground">PDF · 한글(hwp, hwpx) · 워드 · 엑셀 · 파워포인트 · 이미지, 파일당 50MB까지</span>
            <input
              key={inputKey}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
            />
          </label>

          {picked.length > 0 && (
            <ul className="rounded-lg border divide-y text-sm">
              {picked.map((f) => (
                <li key={f.name + f.size} className="flex items-center gap-2 px-3 py-2">
                  <FileTypeIcon name={f.name} />
                  <span className="flex-1 min-w-0 truncate">{f.name}</span>
                  <span className="text-muted-foreground tabular-nums">{formatSize(f.size)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="메모 (선택) 예: 10월 책장 라벨, A4 2장"
              value={memo}
              maxLength={300}
              onChange={(e) => setMemo(e.target.value)}
              className="h-11"
            />
            <Button className="h-11 px-6 shrink-0" onClick={handleUpload} disabled={picked.length === 0 || !!uploading}>
              {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
              {picked.length > 1 ? `${picked.length}개 올리기` : "올리기"}
            </Button>
          </div>
          {uploading && <p className="text-sm text-muted-foreground">올리는 중… {uploading}</p>}
          {message && (
            <p className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-destructive"}`}>{message.text}</p>
          )}
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            파일 목록
            {files && <Badge variant="secondary">{files.length}개</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!files ? (
            <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : files.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">아직 올린 파일이 없어요.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {files.map((f) => (
                <li key={f.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <FileTypeIcon name={f.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-all">{f.name}</p>
                      {editId === f.id ? (
                        <div className="flex gap-1 mt-1">
                          <Input
                            value={editMemo}
                            maxLength={300}
                            onChange={(e) => setEditMemo(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => handleSaveMemo(f)} disabled={busyId === f.id} aria-label="메모 저장">
                            <Check className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditId(null)} aria-label="취소">
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(f.id); setEditMemo(f.memo ?? ""); }}
                          className="mt-0.5 text-sm text-left text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          {f.memo ? <span className="whitespace-pre-wrap break-all">{f.memo}</span> : <span className="italic">메모 없음</span>}
                          <Pencil className="size-3 shrink-0" />
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {formatSize(f.size)} · {new Date(f.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}
                        {f.uploader && ` · ${f.uploader}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 sm:justify-end">
                    {confirmId === f.id ? (
                      <>
                        <span className="self-center text-sm text-destructive">삭제할까요?</span>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(f)} disabled={busyId === f.id}>
                          {busyId === f.id && <Loader2 className="size-4 mr-1 animate-spin" />}삭제
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>취소</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => handleDownload(f)} disabled={busyId === f.id}>
                          {busyId === f.id ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />}
                          내려받기
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmId(f.id)} aria-label="삭제">
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
