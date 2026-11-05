"use client";

// 회원 상세의 "학원 정보"(학년·ZPD·재원/퇴원) 카드. 학원 모드가 아니면 아무것도 그리지 않는다
// (학원이 아닐 때는 academy 서버 액션도 부르지 않는다).

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, Pencil } from "lucide-react";
import { getPublicSettings } from "@/app/actions/settings";
import { getStudentAcademyInfo, saveStudentAcademyInfo, type AcademyMemberInfo } from "@/app/actions/academy";
import { isAcademy } from "@/lib/site-mode";

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

  useEffect(() => {
    let alive = true;
    getPublicSettings()
      .then(async (s) => {
        if (!alive || !isAcademy(s.site_type)) return;
        setEnabled(true);
        const res = await getStudentAcademyInfo(userId);
        if (!alive) return;
        if (res.success && res.data) setInfo(res.data);
        else setMsg({ type: "error", text: res.error || "학원 정보를 불러오지 못했습니다." });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!enabled) return null;

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
      </CardContent>
    </Card>
  );
}
