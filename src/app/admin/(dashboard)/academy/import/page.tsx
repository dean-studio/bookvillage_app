"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle2, XCircle, AlertCircle, Eye } from "lucide-react";
import {
  importBooks,
  importArInfo,
  importStudents,
  findExistingIsbns,
  ensureClasses,
  type ImportLineResult,
  type ArImportLineResult,
} from "@/app/actions/academy";
import { getShelves } from "@/app/actions/shelves";
import { getLibrarySettings } from "@/app/actions/settings";
import { parseGroups } from "@/lib/member-card";
import {
  IMPORT_COLUMNS,
  IMPORT_KIND_LABELS,
  MAX_IMPORT_ROWS,
  buildTemplateCsv,
  checkImportRow,
  cleanIsbn,
  decodeFileText,
  exampleLine,
  mapTable,
  parseDelimited,
  type ImportKind,
  type ImportRow,
} from "@/lib/academy-import";
import { AcademyGate } from "../academy-gate";
import { cn } from "@/lib/utils";

const KINDS: ImportKind[] = ["books", "ar", "students"];

// 한 번에 서버로 보내는 줄 수 (ISBN 조회·계정 생성이 있는 종류는 작게)
const CHUNK: Record<ImportKind, number> = { books: 10, ar: 50, students: 10 };

const KIND_HELP: Record<ImportKind, string[]> = {
  books: [
    "ISBN이 있으면 책 정보(제목·저자·출판사·표지)를 찾아 빈 칸을 채웁니다. 엑셀에 적은 값이 먼저입니다.",
    "바코드 칸이 비어 있으면 ISBN을 바코드로 씁니다. 같은 ISBN 책이 이미 있으면(복본) 자체 바코드(BV…)를 자동으로 붙입니다.",
    "책장 칸에는 이미 만들어 둔 책장 이름을 적습니다. 비우면 아래에서 고른 기본 책장에 넣습니다.",
    "AR 칸(AR레벨·AR포인트·퀴즈번호·Interest·단어수·Lexile)은 있으면 같이 저장합니다.",
  ],
  ar: [
    "ISBN → 바코드 → 제목(대소문자 무시, 정확히 같은 제목) 순서로 책을 찾아 AR 칸만 바꿉니다.",
    "같은 ISBN 책이 여러 권(복본)이면 모두 바꿉니다. 같은 제목의 다른 책이 여러 권이면 건너뛰고 목록으로 알려 드립니다.",
    "빈 칸은 바꾸지 않습니다(기존 값 유지).",
  ],
  students: [
    "학생마다 QR 회원카드가 새로 만들어집니다. 등록 후 회원 목록 → QR 카드 인쇄에서 인쇄하세요.",
    "학년은 숫자(1~12, 미취학은 0)로 적습니다. 보호자 연락처·메모는 비워도 됩니다.",
    "반 목록에 없는 반은 등록하면서 반 목록에 추가됩니다.",
  ],
};

type PreviewRow = ImportRow & { error: string | null; note: string | null };

type LineResult = { line: number; ok: boolean; message: string; candidates?: ArImportLineResult["candidates"] };

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ImportPanel({ kind }: { kind: ImportKind }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [ignoredHeaders, setIgnoredHeaders] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);

  // 옵션
  const [lookup, setLookup] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [existingIsbns, setExistingIsbns] = useState<Set<string>>(new Set());
  const [shelves, setShelves] = useState<string[]>([]);
  const [defaultShelf, setDefaultShelf] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [knownGroups, setKnownGroups] = useState<string[]>([]);

  // 실행
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<LineResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);

  useEffect(() => {
    if (kind === "books") {
      getShelves().then((list) => setShelves(list.filter((s) => s.type === "shelf").map((s) => s.name)));
    }
    if (kind === "students") {
      getLibrarySettings().then((s) => setKnownGroups(parseGroups(s.member_groups)));
    }
  }, [kind]);

  const colDefs = IMPORT_COLUMNS[kind];
  const shownCols = colDefs.filter((c) => columns.includes(c.key));

  async function buildPreview(text: string) {
    setParseError(null);
    setResults(null);
    setRunError(null);
    const mapped = mapTable(kind, parseDelimited(text));
    if (!mapped.ok) {
      setParseError(mapped.error);
      setPreview([]);
      setColumns([]);
      return;
    }
    setColumns(mapped.columns);
    setIgnoredHeaders(mapped.ignoredHeaders);
    let rows: PreviewRow[] = mapped.rows.map((r) => ({ ...r, error: checkImportRow(kind, r.values), note: null }));

    if (kind === "books") {
      setPreviewing(true);
      const isbns = rows.filter((r) => !r.error && r.values.isbn).map((r) => r.values.isbn);
      const res = isbns.length > 0 ? await findExistingIsbns(isbns) : { success: true, data: { existing: [] as string[] } };
      setPreviewing(false);
      if (!res.success) {
        setParseError(res.error || "미리보기에 실패했습니다.");
        return;
      }
      const set = new Set(res.data?.existing ?? []);
      setExistingIsbns(set);
      rows = rows.map((r) => {
        const isbn = r.values.isbn ? cleanIsbn(r.values.isbn) : null;
        return isbn && set.has(isbn) ? { ...r, note: "이미 있는 책(같은 ISBN)" } : r;
      });
    }
    if (kind === "students") {
      const seen = new Set<string>();
      rows = rows.map((r) => {
        const notes: string[] = [];
        if (r.values.group && !knownGroups.includes(r.values.group)) notes.push("새 반");
        const key = `${r.values.group}|${r.values.name}`;
        if (seen.has(key)) notes.push("파일 안에 같은 반·이름이 또 있음");
        seen.add(key);
        return notes.length > 0 ? { ...r, note: notes.join(" · ") } : r;
      });
    }
    setPreview(rows);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setParseError("엑셀 파일(.xlsx)은 바로 읽지 못합니다. 엑셀에서 '다른 이름으로 저장 → CSV UTF-8(쉼표로 분리)'로 저장하거나, 표를 복사해 아래 칸에 붙여 넣어 주세요.");
      setPreview([]);
      return;
    }
    const buf = await file.arrayBuffer();
    await buildPreview(decodeFileText(buf));
  }

  function isSkipped(r: PreviewRow): boolean {
    if (r.error) return true;
    if (kind === "books" && skipExisting && r.values.isbn) {
      const isbn = cleanIsbn(r.values.isbn);
      return !!isbn && existingIsbns.has(isbn);
    }
    return false;
  }

  const sendable = preview.filter((r) => !isSkipped(r));
  const errorCount = preview.filter((r) => r.error).length;
  const skippedExisting = preview.filter((r) => !r.error && isSkipped(r)).length;

  async function run() {
    if (sendable.length === 0) return;
    if (kind === "books" && !defaultShelf && sendable.some((r) => !r.values.shelf)) {
      setRunError("책장 칸이 빈 줄이 있습니다. 기본 책장을 골라 주세요.");
      return;
    }
    setRunning(true);
    setRunError(null);
    setResults(null);
    setProgress({ done: 0, total: sendable.length });

    const out: LineResult[] = preview
      .filter((r) => isSkipped(r))
      .map((r) => ({ line: r.line, ok: false, message: r.error ? `건너뜀: ${r.error}` : "건너뜀: 이미 있는 책" }));

    if (kind === "students") {
      const groups = [...new Set(sendable.map((r) => r.values.group).filter((g) => g && !knownGroups.includes(g)))];
      if (groups.length > 0) {
        const res = await ensureClasses(groups);
        if (!res.success) {
          setRunError(res.error || "반 목록 저장에 실패했습니다.");
          setRunning(false);
          return;
        }
        setKnownGroups((prev) => [...prev, ...(res.data?.added ?? [])]);
      }
    }

    const size = CHUNK[kind];
    for (let i = 0; i < sendable.length; i += size) {
      const part: ImportRow[] = sendable.slice(i, i + size).map(({ line, values }) => ({ line, values }));
      let res: { success: boolean; error?: string; data?: { results: (ImportLineResult | ArImportLineResult)[] } };
      try {
        if (kind === "books") res = await importBooks(part, { lookup, defaultShelf });
        else if (kind === "ar") res = await importArInfo(part);
        else res = await importStudents(part, { skipDuplicates });
      } catch {
        res = { success: false, error: "서버와 연결이 끊겼습니다." };
      }
      if (!res.success || !res.data) {
        for (const r of part) out.push({ line: r.line, ok: false, message: res.error || "처리에 실패했습니다." });
      } else {
        out.push(...res.data.results);
      }
      setProgress({ done: Math.min(i + size, sendable.length), total: sendable.length });
      setResults([...out].sort((a, b) => a.line - b.line));
    }
    setResults([...out].sort((a, b) => a.line - b.line));
    setRunning(false);
  }

  function downloadFailed() {
    if (!results) return;
    const failedLines = new Set(results.filter((r) => !r.ok).map((r) => r.line));
    const msgByLine = new Map(results.map((r) => [r.line, r.message]));
    const header = [...colDefs.map((c) => c.label), "오류"];
    const lines = preview
      .filter((r) => failedLines.has(r.line))
      .map((r) => [...colDefs.map((c) => csvCell(r.values[c.key] ?? "")), csvCell(msgByLine.get(r.line) ?? "")].join(","));
    downloadText(`실패한줄_${IMPORT_KIND_LABELS[kind]}.csv`, "\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n");
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = (results?.length ?? 0) - okCount;
  const shownResults = useMemo(() => (results ? (failedOnly ? results.filter((r) => !r.ok) : results) : []), [results, failedOnly]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {IMPORT_KIND_LABELS[kind]}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => downloadText(`양식_${IMPORT_KIND_LABELS[kind]}.csv`, buildTemplateCsv(kind))}
            >
              <Download className="size-4 mr-1" />
              양식 내려받기 (CSV)
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {KIND_HELP[kind].map((t) => (
              <li key={t}>{t}</li>
            ))}
            <li>
              칸: {colDefs.map((c) => (c.required ? `${c.label}(필수)` : c.label)).join(", ")}. 한 번에 {MAX_IMPORT_ROWS}줄까지.
            </li>
            <li>예: {exampleLine(kind)}</li>
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={running}>
              <Upload className="size-4 mr-1" />
              CSV 파일 고르기
            </Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">또는 엑셀에서 머리글 줄까지 표를 복사해 붙여 넣으세요.</p>
            <textarea
              className="w-full min-h-28 rounded-md border bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={colDefs.map((c) => c.label).join("\t")}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              disabled={running}
            />
            <Button
              variant="outline"
              onClick={() => {
                setFileName("");
                buildPreview(pasted);
              }}
              disabled={!pasted.trim() || running || previewing}
            >
              {previewing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Eye className="size-4 mr-1" />}
              미리보기
            </Button>
          </div>

          {parseError && (
            <p className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {parseError}
            </p>
          )}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              미리보기
              <Badge variant="secondary">{preview.length}줄</Badge>
              {errorCount > 0 && <Badge variant="destructive">오류 {errorCount}줄</Badge>}
              {skippedExisting > 0 && <Badge variant="outline">이미 있는 책 {skippedExisting}줄</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ignoredHeaders.length > 0 && (
              <p className="text-sm text-muted-foreground">모르는 칸은 무시합니다: {ignoredHeaders.join(", ")}</p>
            )}

            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">줄</th>
                    <th className="px-2 py-1.5 text-left font-medium">확인</th>
                    {shownCols.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.line} className={cn("border-t", r.error && "bg-destructive/5")}>
                      <td className="px-2 py-1 text-muted-foreground">{r.line}</td>
                      <td className="px-2 py-1 min-w-40">
                        {r.error ? (
                          <span className="text-destructive">{r.error}</span>
                        ) : r.note ? (
                          <span className="text-amber-600">{r.note}</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                      {shownCols.map((c) => (
                        <td key={c.key} className="px-2 py-1 max-w-56 truncate" title={r.values[c.key]}>
                          {r.values[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 옵션 */}
            <div className="space-y-2">
              {kind === "books" && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4" checked={lookup} onChange={(e) => setLookup(e.target.checked)} />
                    ISBN으로 책 정보 찾아 빈 칸 채우기 (느려질 수 있음)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                    이미 있는 책(같은 ISBN)은 건너뛰기 — 끄면 복본으로 한 권 더 등록
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>기본 책장 (책장 칸이 빈 줄)</span>
                    <select
                      className="h-9 rounded-md border bg-background px-2"
                      value={defaultShelf}
                      onChange={(e) => setDefaultShelf(e.target.value)}
                    >
                      <option value="">고르지 않음</option>
                      {shelves.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {kind === "students" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                  같은 반에 같은 이름의 학생이 이미 있으면 건너뛰기
                </label>
              )}
            </div>

            {runError && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4" />
                {runError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={run} disabled={running || sendable.length === 0}>
                {running ? <Loader2 className="size-4 mr-1 animate-spin" /> : <FileSpreadsheet className="size-4 mr-1" />}
                {kind === "ar" ? "AR 정보 넣기" : "등록 시작"} ({sendable.length}줄)
              </Button>
              {running && (
                <span className="text-sm text-muted-foreground">
                  {progress.done} / {progress.total} 처리 중… 창을 닫지 마세요.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              결과
              <Badge className="bg-green-600 hover:bg-green-600">성공 {okCount}</Badge>
              {failCount > 0 && <Badge variant="destructive">실패·건너뜀 {failCount}</Badge>}
              <div className="ml-auto flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm font-normal">
                  <input type="checkbox" className="size-4" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
                  실패만 보기
                </label>
                {failCount > 0 && !running && (
                  <Button size="sm" variant="outline" onClick={downloadFailed}>
                    <Download className="size-4 mr-1" />
                    실패한 줄 CSV
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium w-14">줄</th>
                    <th className="px-2 py-1.5 text-left font-medium w-16">결과</th>
                    <th className="px-2 py-1.5 text-left font-medium">내용</th>
                  </tr>
                </thead>
                <tbody>
                  {shownResults.map((r) => (
                    <tr key={r.line} className="border-t align-top">
                      <td className="px-2 py-1 text-muted-foreground">{r.line}</td>
                      <td className="px-2 py-1">
                        {r.ok ? <CheckCircle2 className="size-4 text-green-600" /> : <XCircle className="size-4 text-destructive" />}
                      </td>
                      <td className={cn("px-2 py-1", !r.ok && "text-destructive")}>
                        {r.message}
                        {r.candidates && r.candidates.length > 0 && (
                          <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                            {r.candidates.map((c) => (
                              <li key={c.barcode}>
                                {c.title} · {c.author || "저자 없음"} · <span className="font-mono">{c.barcode}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportView() {
  const [kind, setKind] = useState<ImportKind>("books");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileSpreadsheet className="size-6" />
        일괄 등록
      </h1>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button key={k} variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
            {IMPORT_KIND_LABELS[k]}
          </Button>
        ))}
      </div>
      {/* 탭을 바꿔도 진행 중인 작업·결과가 사라지지 않게 셋 다 그려 두고 숨긴다 */}
      {KINDS.map((k) => (
        <div key={k} className={cn(kind !== k && "hidden")}>
          <ImportPanel kind={k} />
        </div>
      ))}
    </div>
  );
}

export default function AcademyImportPage() {
  return (
    <AcademyGate>
      <ImportView />
    </AcademyGate>
  );
}
