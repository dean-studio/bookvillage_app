"use client";

// 회원 상세의 "학원 정보"(학년·ZPD·재원/퇴원) 카드. 학원 모드가 아니면 아무것도 그리지 않는다
// (학원이 아닐 때는 academy 서버 액션도 부르지 않는다).
// AR 사용(ar_enabled === 'on')이면 AR 퀴즈 통과 권수·누적 포인트·단어 수와 통과 목록(체크한 선생님 포함)도 보여 주고,
// "책 찾아서 통과 기록"으로 이 학생이 빌렸던(반납된) 책이나 대출 기록이 없는 책을 골라 통과를 기록할 수 있다.

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, Pencil, Search, Undo2 } from "lucide-react";
import Link from "next/link";
import { getPublicSettings } from "@/app/actions/settings";
import {
  cancelArPass,
  getStudentAcademyInfo,
  getStudentArSummary,
  recordArPassForBook,
  saveStudentAcademyInfo,
  searchArPassCandidates,
  type AcademyMemberInfo,
  type ArPassCandidateBook,
  type ArPassCandidateRental,
  type ArPassRecord,
  type ArStudentSummary,
} from "@/app/actions/academy";
import { isAcademy, isFlagOn } from "@/lib/site-mode";
import { ArPassButton } from "../../academy/ar-pass";

function numStr(v: number | null): string {
  return v === null ? "" : String(v);
}

function arInfo(level: number | null, points: number | null): string {
  return [level !== null ? `BL ${level.toFixed(1)}` : "", points !== null ? `${points.toFixed(1)}pt` : ""].filter(Boolean).join(" · ");
}

/** "책 찾아서 통과 기록": 제목/바코드 검색 → 빌렸던(반납된) 책 / 대출 기록 없는 책에서 골라 기록 */
function ArPassFinder({ userId, onRecorded }: { userId: string; onRecorded: () => void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; rentals: ArPassCandidateRental[]; books: ArPassCandidateBook[] } | null>(null);
  const [error, setError] = useState("");
  const [isSearching, startSearching] = useTransition();

  function search() {
    const q = query.trim();
    setError("");
    startSearching(async () => {
      const res = await searchArPassCandidates(userId, q);
      if (!res.success || !res.data) {
        setError(res.error || "책을 찾지 못했습니다.");
        setFound(null);
        return;
      }
      setFound({ query: q, ...res.data });
    });
  }

  function updateRental(rentalId: string, next: ArPassRecord | null) {
    setFound((f) => (f ? { ...f, rentals: f.rentals.map((r) => (r.rental_id === rentalId ? { ...r, result: next } : r)) } : f));
    onRecorded();
  }
  function updateBook(bookId: string, next: ArPassRecord | null) {
    setFound((f) => (f ? { ...f, books: f.books.map((b) => (b.book_id === bookId ? { ...b, result: next } : b)) } : f));
    onRecorded();
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input className="h-10" placeholder="제목 또는 바코드 (비우면 최근 반납한 책)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" className="h-10 shrink-0" disabled={isSearching}>
          {isSearching ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Search className="size-4 mr-1" />}
          찾기
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {found && (
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <p className="font-medium">이 학생이 빌렸던 책 {found.query ? "" : "(최근 반납)"}</p>
            {found.rentals.length === 0 ? (
              <p className="text-muted-foreground">맞는 반납 기록이 없습니다.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {found.rentals.map((r) => (
                  <li key={r.rental_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="font-medium">{r.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.barcode}</span>
                    {arInfo(r.ar_level, r.ar_points) && <span className="text-xs text-muted-foreground">{arInfo(r.ar_level, r.ar_points)}</span>}
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.returned_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 반납
                    </span>
                    <span className="ml-auto">
                      <ArPassButton rentalId={r.rental_id} result={r.result} onChange={(next) => updateRental(r.rental_id, next)} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {found.query && (
            <div className="space-y-1.5">
              <p className="font-medium">대출 기록이 없는 책</p>
              <p className="text-xs text-muted-foreground">학원 밖에서 읽은 책 등. 대출 기록 없이 통과만 기록합니다 (지금 빌려 간 책은 반납한 뒤 기록하세요).</p>
              {found.books.length === 0 ? (
                <p className="text-muted-foreground">맞는 책이 없습니다.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {found.books.map((b) => (
                    <li key={b.book_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="font-medium">{b.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">{b.barcode}</span>
                      {arInfo(b.ar_level, b.ar_points) && <span className="text-xs text-muted-foreground">{arInfo(b.ar_level, b.ar_points)}</span>}
                      <span className="ml-auto">
                        <ArPassButton
                          recordFn={() => recordArPassForBook(userId, b.book_id)}
                          result={b.result}
                          onChange={(next) => updateBook(b.book_id, next)}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AcademyStudentCard({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [info, setInfo] = useState<AcademyMemberInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ grade: "", zpd_low: "", zpd_high: "", status: "active" as "active" | "inactive" });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  // AR 통과 기록 (ar_enabled 일 때만)
  const [arOn, setArOn] = useState(false);
  const [ar, setAr] = useState<ArStudentSummary | null>(null);
  const [arError, setArError] = useState("");
  const [showAllAr, setShowAllAr] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCanceling, startCanceling] = useTransition();
  const [showFinder, setShowFinder] = useState(false);

  useEffect(() => {
    let alive = true;
    getPublicSettings()
      .then(async (s) => {
        if (!alive || !isAcademy(s.site_type)) return;
        setEnabled(true);
        const withAr = isFlagOn(s, "ar_enabled");
        setArOn(withAr);
        const [res, arRes] = await Promise.all([
          getStudentAcademyInfo(userId),
          withAr ? getStudentArSummary(userId) : Promise.resolve(null),
        ]);
        if (!alive) return;
        if (res.success && res.data) setInfo(res.data);
        else setMsg({ type: "error", text: res.error || "학원 정보를 불러오지 못했습니다." });
        if (arRes) {
          if (arRes.success && arRes.data) setAr(arRes.data);
          else setArError(arRes.error || "AR 통과 기록을 불러오지 못했습니다.");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!enabled) return null;

  async function reloadAr() {
    const again = await getStudentArSummary(userId);
    if (again.success && again.data) setAr(again.data);
  }

  function handleCancelAr(id: string) {
    setArError("");
    startCanceling(async () => {
      const res = await cancelArPass(id);
      setCancelId(null);
      if (!res.success) {
        setArError(res.error || "취소에 실패했습니다.");
        return;
      }
      const again = await getStudentArSummary(userId);
      if (again.success && again.data) setAr(again.data);
    });
  }

  function startEdit() {
    setForm({
      grade: numStr(info?.grade ?? null),
      zpd_low: numStr(info?.zpd_low ?? null),
      zpd_high: numStr(info?.zpd_high ?? null),
      status: info?.status ?? "active",
    });
    setMsg(null);
    setEditing(true);
  }

  function handleSave() {
    setMsg(null);
    startSaving(async () => {
      const res = await saveStudentAcademyInfo(userId, form);
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "저장에 실패했습니다." });
        return;
      }
      setInfo(res.data);
      setEditing(false);
      setMsg({ type: "success", text: "저장되었습니다." });
      setTimeout(() => setMsg(null), 2000);
    });
  }

  const gradeLabel = info?.grade === null || info?.grade === undefined ? "-" : info.grade === 0 ? "미취학" : `${info.grade}학년`;
  const zpdLabel =
    !info || (info.zpd_low === null && info.zpd_high === null)
      ? "-"
      : `${info.zpd_low === null ? "?" : Number(info.zpd_low).toFixed(1)} ~ ${info.zpd_high === null ? "?" : Number(info.zpd_high).toFixed(1)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4" />
          학원 정보
          {info?.status === "inactive" && <Badge variant="outline">퇴원</Badge>}
          {!editing && info && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={startEdit}>
              <Pencil className="size-4 mr-1" />
              수정
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!info && !msg ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : editing ? (
          <div className="space-y-4 max-w-xl">
            <div className="grid grid-cols-3 gap-3">
              {([
                ["grade", "학년 (미취학 0)", "numeric"],
                ["zpd_low", "ZPD 하한", "decimal"],
                ["zpd_high", "ZPD 상한", "decimal"],
              ] as const).map(([key, label, mode]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium">{label}</label>
                  <Input
                    className="h-12 text-lg"
                    inputMode={mode}
                    maxLength={4}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">상태</span>
              {(["active", "inactive"] as const).map((st) => (
                <Button
                  key={st}
                  size="sm"
                  variant={form.status === st ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, status: st }))}
                >
                  {st === "active" ? "재원" : "퇴원"}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 mr-1 animate-spin" />}
                저장
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={isSaving}>
                취소
              </Button>
            </div>
          </div>
        ) : info ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">학년</p>
              <p className="font-semibold">{gradeLabel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">레벨(ZPD)</p>
              <p className="font-semibold">{zpdLabel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">상태</p>
              <p className="font-semibold">{info.status === "inactive" ? "퇴원" : "재원"}</p>
            </div>
          </div>
        ) : null}
        {msg && <p className={`text-sm ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}

        {arOn && (
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">AR 퀴즈 통과</p>
              <Button size="sm" variant={showFinder ? "secondary" : "outline"} className="ml-auto" onClick={() => setShowFinder((v) => !v)}>
                <Search className="size-4 mr-1" />
                {showFinder ? "책 찾기 닫기" : "책 찾아서 통과 기록"}
              </Button>
            </div>
            {showFinder && <ArPassFinder userId={userId} onRecorded={() => void reloadAr()} />}
            {!ar && !arError ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : ar ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">통과</p>
                    <p className="font-semibold">{ar.passedCount}권</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">누적 포인트</p>
                    <p className="font-semibold">{ar.totalPoints.toFixed(1)}pt</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">읽은 단어 수</p>
                    <p className="font-semibold">{ar.totalWords.toLocaleString()}</p>
                  </div>
                </div>
                {ar.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    아직 통과 기록이 없습니다. 반납 화면·반별 현황에서 &lsquo;AR 통과&rsquo;를 체크하거나 위 &lsquo;책 찾아서 통과 기록&rsquo;으로 기록하면 여기에 쌓입니다.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border text-sm">
                    {(showAllAr ? ar.items : ar.items.slice(0, 10)).map((it) => (
                      <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        {it.book_id ? (
                          <Link href={`/admin/books/${it.book_id}`} className="font-medium hover:underline">
                            {it.title}
                          </Link>
                        ) : (
                          <span className="font-medium text-muted-foreground">{it.title}</span>
                        )}
                        {it.ar_level !== null && <span className="font-mono text-xs text-muted-foreground">BL {it.ar_level.toFixed(1)}</span>}
                        <Badge variant="secondary">{it.points.toFixed(1)}pt</Badge>
                        {it.words !== null && <span className="text-xs text-muted-foreground">{it.words.toLocaleString()} words</span>}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {it.created_at ? new Date(it.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : ""}
                          {it.recorded_by_name && ` · ${it.recorded_by_name} 선생님`}
                        </span>
                        {cancelId === it.id ? (
                          <span className="flex items-center gap-1">
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={isCanceling} onClick={() => handleCancelAr(it.id)}>
                              {isCanceling && <Loader2 className="size-3 mr-1 animate-spin" />}
                              통과 취소
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={isCanceling} onClick={() => setCancelId(null)}>
                              그대로 두기
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setCancelId(it.id)}>
                            <Undo2 className="size-3.5 mr-1" />
                            취소
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {ar.items.length > 10 && (
                  <Button size="sm" variant="ghost" onClick={() => setShowAllAr((v) => !v)}>
                    {showAllAr ? "접기" : `전체 ${ar.items.length}권 보기`}
                  </Button>
                )}
              </>
            ) : null}
            {arError && <p className="text-sm text-destructive">{arError}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
