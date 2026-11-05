"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, Save, Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { getBooksMissingAr, saveArBatch, type ArMissingGroup } from "@/app/actions/academy";
import { ArFindLink } from "@/components/ar-fields";
import { AR_INTERESTS, EMPTY_AR, hasAnyArValue, validateArValues, type ArValues } from "@/lib/ar";
import { AcademyGate } from "../academy-gate";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

// 입력 칸 순서 (Tab 은 브라우저 기본 순서, Enter 는 같은 칸의 다음 줄로)
const COLS: { key: keyof ArValues; label: string; placeholder: string; width: string; inputMode?: "decimal" | "numeric" }[] = [
  { key: "ar_level", label: "BL", placeholder: "3.5", width: "w-20", inputMode: "decimal" },
  { key: "ar_points", label: "Points", placeholder: "2.0", width: "w-20", inputMode: "decimal" },
  { key: "ar_quiz_no", label: "Quiz No", placeholder: "12345", width: "w-28", inputMode: "numeric" },
  { key: "ar_interest", label: "Interest", placeholder: "", width: "w-24" },
  { key: "word_count", label: "단어 수", placeholder: "4500", width: "w-24", inputMode: "numeric" },
  { key: "lexile", label: "Lexile", placeholder: "500L", width: "w-24" },
];

function rowKey(g: ArMissingGroup): string {
  return g.ids[0];
}

function ArMissingView() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<ArMissingGroup[]>([]);
  const [meta, setMeta] = useState({ totalGroups: 0, totalBooks: 0, totalPages: 1, truncated: false });
  const [edits, setEdits] = useState<Record<string, ArValues>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const load = useCallback((p: number, q: string) => {
    startLoading(async () => {
      const res = await getBooksMissingAr({ q, page: p, limit: PAGE_SIZE });
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "불러오지 못했습니다." });
        return;
      }
      setGroups(res.data.groups);
      setMeta({ totalGroups: res.data.totalGroups, totalBooks: res.data.totalBooks, totalPages: res.data.totalPages, truncated: res.data.truncated });
      setEdits({});
      setRowErrors({});
    });
  }, []);

  useEffect(() => {
    load(page, appliedQuery);
  }, [page, appliedQuery, load]);

  const dirtyKeys = Object.keys(edits).filter((k) => hasAnyArValue(edits[k]));

  function confirmLeave(): boolean {
    return dirtyKeys.length === 0 || window.confirm("저장하지 않은 입력이 있습니다. 버리고 이동할까요?");
  }

  function setCell(key: string, col: keyof ArValues, value: string) {
    setEdits((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_AR), [col]: value } }));
    setRowErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleEnter(e: React.KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = document.querySelector<HTMLElement>(`[data-ar-row="${rowIdx + (e.shiftKey ? -1 : 1)}"][data-ar-col="${colIdx}"]`);
    next?.focus();
  }

  function handleSave() {
    setMsg(null);
    const errors: Record<string, string> = {};
    for (const k of dirtyKeys) {
      const err = validateArValues(edits[k]);
      if (err) errors[k] = err;
    }
    if (Object.keys(errors).length > 0) {
      setRowErrors(errors);
      setMsg({ type: "error", text: `${Object.keys(errors).length}줄에 잘못된 값이 있습니다. 빨간 줄을 고쳐 주세요.` });
      return;
    }
    const targets = groups.filter((g) => dirtyKeys.includes(rowKey(g)));
    if (targets.length === 0) return;
    startSaving(async () => {
      const res = await saveArBatch(
        targets.map((g) => {
          const v = edits[rowKey(g)];
          return { ids: g.ids, values: { ...v, ar_interest: v.ar_interest.trim().toUpperCase() } };
        })
      );
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "저장에 실패했습니다." });
        return;
      }
      const failed: Record<string, string> = {};
      let savedBooks = 0;
      let savedRows = 0;
      for (const r of res.data.results) {
        const g = targets[r.index];
        if (!g) continue;
        if (r.ok) {
          savedRows++;
          savedBooks += r.count;
        } else {
          failed[rowKey(g)] = r.message;
        }
      }
      const failCount = Object.keys(failed).length;
      setMsg(
        failCount > 0
          ? { type: "error", text: `${savedRows}줄(${savedBooks}권) 저장, ${failCount}줄 실패. 빨간 줄을 확인하세요.` }
          : { type: "success", text: `${savedRows}줄(${savedBooks}권) 저장했습니다.` }
      );
      if (failCount === 0) {
        // 모두 저장됐으면 지금 페이지를 다시 읽는다 (저장한 책은 목록에서 빠지고 뒤쪽 책이 당겨짐)
        load(page, appliedQuery);
        return;
      }
      // 실패가 있으면 저장된 줄만 목록에서 빼고, 실패한 줄은 입력을 남긴다
      const savedKeys = new Set(targets.map(rowKey).filter((k) => !failed[k]));
      setGroups((prev) => prev.filter((g) => !savedKeys.has(rowKey(g))));
      setEdits((prev) => {
        const next: Record<string, ArValues> = {};
        for (const [k, v] of Object.entries(prev)) if (!savedKeys.has(k)) next[k] = v;
        return next;
      });
      setRowErrors(failed);
      setMeta((m) => ({ ...m, totalGroups: Math.max(0, m.totalGroups - savedRows), totalBooks: Math.max(0, m.totalBooks - savedBooks) }));
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <GraduationCap className="size-6" />
        AR 정보 입력
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            AR 레벨이 비어 있는 책
            <Badge variant="secondary">
              {meta.totalGroups}종 · {meta.totalBooks}권
            </Badge>
            <form
              className="ml-auto flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!confirmLeave()) return;
                setPage(1);
                setAppliedQuery(query.trim());
              }}
            >
              <Input className="h-9 w-56" placeholder="제목·저자·바코드·ISBN" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button size="sm" variant="outline" type="submit">
                <Search className="size-4" />
              </Button>
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            칸 사이는 Tab, 아래 줄 같은 칸은 Enter로 이동합니다. 같은 ISBN 책(복본)은 한 줄로 묶어 함께 저장합니다. AR 찾기를 누르면 제목이 복사되고 AR BookFinder가 열립니다.
          </p>
          {meta.truncated && <p className="text-sm text-amber-600">책이 많아 앞쪽 10,000권만 보여 줍니다. 검색으로 좁혀 주세요.</p>}

          {msg && (
            <p className={cn("flex items-center gap-1.5 text-sm", msg.type === "success" ? "text-green-600" : "text-destructive")}>
              {msg.type === "error" && <AlertCircle className="size-4" />}
              {msg.text}
            </p>
          )}

          {isLoading && groups.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{appliedQuery ? "검색 결과가 없습니다." : "AR 정보가 비어 있는 책이 없습니다."}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">책</th>
                    {COLS.map((c) => (
                      <th key={c.key} className="px-1 py-2 text-left font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, rowIdx) => {
                    const key = rowKey(g);
                    const v = edits[key] ?? EMPTY_AR;
                    const err = rowErrors[key];
                    return (
                      <tr key={key} className={cn("border-t align-top", err && "bg-destructive/5", hasAnyArValue(v) && !err && "bg-primary/5")}>
                        <td className="px-2 py-1.5 min-w-56">
                          <Link href={`/admin/books/${g.ids[0]}`} className="font-medium hover:underline" tabIndex={-1}>
                            {g.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {[g.author, g.isbn, g.shelf].filter(Boolean).join(" · ")}
                            {g.ids.length > 1 && <span className="ml-1 font-medium text-foreground">· 복본 {g.ids.length}권</span>}
                          </p>
                          <div className="flex items-center gap-2">
                            <ArFindLink title={g.title} />
                            {err && <span className="text-xs text-destructive">{err}</span>}
                          </div>
                        </td>
                        {COLS.map((c, colIdx) => (
                          <td key={c.key} className="px-1 py-1.5">
                            {c.key === "ar_interest" ? (
                              <select
                                data-ar-row={rowIdx}
                                data-ar-col={colIdx}
                                className={cn("h-9 rounded-md border bg-background px-1", c.width)}
                                value={v.ar_interest}
                                onChange={(e) => setCell(key, "ar_interest", e.target.value)}
                                onKeyDown={(e) => handleEnter(e, rowIdx, colIdx)}
                              >
                                <option value="">-</option>
                                {AR_INTERESTS.map((i) => (
                                  <option key={i} value={i}>
                                    {i}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                data-ar-row={rowIdx}
                                data-ar-col={colIdx}
                                className={cn("h-9 px-2", c.width)}
                                placeholder={c.placeholder}
                                inputMode={c.inputMode}
                                value={v[c.key]}
                                maxLength={c.key === "lexile" ? 10 : 12}
                                onChange={(e) => setCell(key, c.key, e.target.value)}
                                onKeyDown={(e) => handleEnter(e, rowIdx, colIdx)}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving || dirtyKeys.length === 0}>
              {isSaving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
              한 번에 저장 ({dirtyKeys.length}줄)
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => {
                  if (confirmLeave()) setPage((p) => p - 1);
                }}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.totalPages || isLoading}
                onClick={() => {
                  if (confirmLeave()) setPage((p) => p + 1);
                }}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcademyArMissingPage() {
  return (
    <AcademyGate>
      <ArMissingView />
    </AcademyGate>
  );
}
