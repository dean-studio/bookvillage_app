"use client";

// 회원 상세의 "학원 정보"(학년·ZPD·재원/퇴원) 카드. 학원 모드가 아니면 아무것도 그리지 않는다
// (학원이 아닐 때는 academy 서버 액션도 부르지 않는다).
// AR 사용(ar_enabled === 'on')이면 AR 퀴즈 통과 권수·누적 포인트·단어 수와 통과 목록도 보여 준다.

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, Pencil, Undo2 } from "lucide-react";
import Link from "next/link";
import { getPublicSettings } from "@/app/actions/settings";
import {
  cancelArPass,
  getStudentAcademyInfo,
  getStudentArSummary,
  saveStudentAcademyInfo,
  type AcademyMemberInfo,
  type ArStudentSummary,
} from "@/app/actions/academy";
import { isAcademy, isFlagOn } from "@/lib/site-mode";

function numStr(v: number | null): string {
  return v === null ? "" : String(v);
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
            <p className="text-sm font-semibold">AR 퀴즈 통과</p>
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
                    아직 통과 기록이 없습니다. 반납 화면이나 반별 현황에서 &lsquo;AR 통과&rsquo;를 체크하면 여기에 쌓입니다.
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
