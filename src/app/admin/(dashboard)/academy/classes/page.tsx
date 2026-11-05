"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { School, Loader2, RefreshCw, Pencil, AlertTriangle, ArrowRightLeft, UserX, UserCheck, AlertCircle } from "lucide-react";
import {
  getAcademyClassOverview,
  getAcademyClassStudents,
  previewClassRename,
  renameClass,
  moveStudentsToClass,
  setStudentsStatus,
  getRecentReturnsForAr,
  type AcademyClassSummary,
  type AcademyStudent,
  type ArReturnItem,
} from "@/app/actions/academy";
import { AcademyGate } from "../academy-gate";
import { ArPassButton } from "../ar-pass";
import { useArEnabled } from "@/components/ar-fields";
import { cn } from "@/lib/utils";

function shortDate(d: string): string {
  return new Date(d).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
}

function className(name: string): string {
  return name === "" ? "(반 없음)" : name;
}

function ClassesView() {
  const [classes, setClasses] = useState<AcademyClassSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [students, setStudents] = useState<AcademyStudent[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isStudentsLoading, startStudentsLoading] = useTransition();
  const [isActing, startActing] = useTransition();

  // AR 사용(ar_enabled === 'on')일 때만: 학생별 최근 반납한 책 + AR 통과 체크
  const arEnabled = useArEnabled();
  const [returnsByUser, setReturnsByUser] = useState<Record<string, ArReturnItem[]>>({});
  const [returnsError, setReturnsError] = useState("");

  // 반 이름 변경
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamePreview, setRenamePreview] = useState<{ studentCount: number; to: string } | null>(null);

  // 반 이동 / 퇴원·복귀 확인
  const [moveTarget, setMoveTarget] = useState("");
  const [confirm, setConfirm] = useState<null | { kind: "move"; to: string } | { kind: "status"; status: "active" | "inactive" }>(null);

  const loadOverview = useCallback((keep?: string | null) => {
    startLoading(async () => {
      const res = await getAcademyClassOverview();
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "불러오지 못했습니다." });
        return;
      }
      const list = res.data.classes;
      setClasses(list);
      setSelected((prev) => {
        const want = keep !== undefined ? keep : prev;
        if (want !== null && list.some((c) => c.name === want)) return want;
        return list[0]?.name ?? null;
      });
    });
  }, []);

  const loadStudents = useCallback((group: string, inactive: boolean) => {
    startStudentsLoading(async () => {
      const res = await getAcademyClassStudents(group, inactive);
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "학생 목록을 불러오지 못했습니다." });
        setStudents([]);
        return;
      }
      setStudents(res.data.students);
    });
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selected !== null) loadStudents(selected, showInactive);
  }, [selected, showInactive, loadStudents]);

  useEffect(() => {
    // 학생이 없으면 부르지 않는다 (목록에 없는 학생의 기록은 화면에서 쓰이지 않음)
    if (!arEnabled || students.length === 0) return;
    let alive = true;
    getRecentReturnsForAr(students.map((s) => s.id)).then((res) => {
      if (!alive) return;
      if (res.success && res.data) {
        setReturnsByUser(res.data.byUser);
        setReturnsError("");
      } else {
        setReturnsByUser({});
        setReturnsError(res.error || "최근 반납한 책을 불러오지 못했습니다.");
      }
    });
    return () => {
      alive = false;
    };
  }, [arEnabled, students]);

  function updateReturnResult(userId: string, rentalId: string, next: ArReturnItem["result"]) {
    setReturnsByUser((prev) => ({
      ...prev,
      [userId]: (prev[userId] ?? []).map((x) => (x.rental_id === rentalId ? { ...x, result: next } : x)),
    }));
  }

  // 반을 바꾸거나 퇴원생 보기를 바꾸면 고른 학생·열린 확인창을 비운다
  function resetSelection() {
    setChecked(new Set());
    setConfirm(null);
    setRenameOpen(false);
    setRenamePreview(null);
  }

  function selectClass(name: string) {
    if (name === selected) return;
    resetSelection();
    setStudents([]);
    setSelected(name);
  }

  function refresh(keep?: string | null) {
    loadOverview(keep);
    const target = keep !== undefined ? keep : selected;
    if (target !== null && target === selected) loadStudents(target, showInactive);
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => (prev.size === students.length ? new Set() : new Set(students.map((s) => s.id))));
  }

  function handleRenameCheck() {
    if (selected === null) return;
    const to = newName.trim();
    if (!to || to.length > 20) {
      setMsg({ type: "error", text: "새 반 이름은 1~20자로 입력해 주세요." });
      return;
    }
    setMsg(null);
    startActing(async () => {
      const res = await previewClassRename(selected);
      if (!res.success || !res.data) {
        setMsg({ type: "error", text: res.error || "확인에 실패했습니다." });
        return;
      }
      setRenamePreview({ studentCount: res.data.studentCount, to });
    });
  }

  function handleRename() {
    if (selected === null || !renamePreview) return;
    const { to, studentCount } = renamePreview;
    startActing(async () => {
      const res = await renameClass(selected, to, studentCount);
      if (!res.success) {
        setMsg({ type: "error", text: res.error || "반 이름 변경에 실패했습니다." });
        setRenamePreview(null);
        return;
      }
      setMsg(
        res.data?.notice
          ? { type: "error", text: `반 이름을 '${to}'(으)로 바꿨습니다. ${res.data.notice}` }
          : { type: "success", text: `반 이름을 '${to}'(으)로 바꿨습니다. 학생 ${res.data?.updated ?? 0}명.` }
      );
      setRenameOpen(false);
      setRenamePreview(null);
      setNewName("");
      resetSelection();
      loadOverview(to);
      setSelected(to);
    });
  }

  function handleConfirm() {
    if (!confirm) return;
    // 지금 화면에 보이는 학생 중 고른 사람만 (반을 다시 읽어 목록이 바뀌었을 때 안 보이는 학생이 섞이지 않게)
    const ids = students.filter((s) => checked.has(s.id)).map((s) => s.id);
    if (ids.length === 0) {
      setConfirm(null);
      return;
    }
    startActing(async () => {
      if (confirm.kind === "move") {
        const res = await moveStudentsToClass(ids, confirm.to);
        if (!res.success) {
          setMsg({ type: "error", text: res.error || "반 이동에 실패했습니다." });
        } else {
          // 반 목록에 없던 새 반은 서버(moveStudentsToClass)가 목록에 추가한다
          const moved = `${res.data?.moved ?? 0}명을 '${confirm.to}' 반으로 옮겼습니다.`;
          setMsg(
            res.data?.warning
              ? { type: "error", text: `${moved} 다만 ${res.data.warning}` }
              : { type: "success", text: `${moved}${res.data?.addedClass ? " 반 목록에도 새 반을 추가했습니다." : ""}` }
          );
          setChecked(new Set());
          setMoveTarget("");
        }
      } else {
        const res = await setStudentsStatus(ids, confirm.status);
        if (!res.success) {
          setMsg({ type: "error", text: res.error || "저장에 실패했습니다." });
        } else {
          setMsg({ type: "success", text: `${res.data?.updated ?? 0}명을 ${confirm.status === "inactive" ? "퇴원" : "복귀"} 처리했습니다.` });
          setChecked(new Set());
        }
      }
      setConfirm(null);
      refresh();
    });
  }

  const current = classes.find((c) => c.name === selected) ?? null;
  const otherClasses = classes.filter((c) => c.name !== selected && c.name !== "");
  const checkedStudents = students.filter((s) => checked.has(s.id));
  const checkedInactive = checkedStudents.filter((s) => s.status === "inactive").length;
  const checkedActive = checkedStudents.length - checkedInactive;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <School className="size-6" />
          반별 현황
        </h1>
        <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      {msg && (
        <p className={cn("flex items-center gap-1.5 text-sm", msg.type === "success" ? "text-green-600" : "text-destructive")}>
          {msg.type === "error" && <AlertCircle className="size-4" />}
          {msg.text}
        </p>
      )}

      {isLoading && classes.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            아직 반이 없습니다. 관리 → 로그인·대출 방식에서 반 목록을 등록하거나, 일괄 등록으로 학생을 올려 주세요.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 반 고르기 */}
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <button
                key={c.name || "__none__"}
                onClick={() => selectClass(c.name)}
                className={cn(
                  "rounded-lg border px-4 py-2.5 text-left transition-colors",
                  selected === c.name ? "border-primary bg-primary/10" : "hover:bg-muted"
                )}
              >
                <p className="font-semibold">
                  {className(c.name)}
                  {!c.listed && c.name !== "" && <span className="ml-1 text-xs font-normal text-muted-foreground">(목록에 없음)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  학생 {c.students}명 · 대출 {c.rentals}권
                  {c.overdue > 0 && <span className="text-destructive font-medium"> · 연체 {c.overdue}권</span>}
                </p>
              </button>
            ))}
          </div>

          {current && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  {className(current.name)}
                  <Badge variant="secondary">학생 {current.students}명</Badge>
                  {current.inactive > 0 && <Badge variant="outline">퇴원 {current.inactive}명</Badge>}
                  {current.overdue > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="size-3 mr-1" />
                      연체 {current.overdue}권
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                      <input type="checkbox" className="size-4" checked={showInactive} onChange={(e) => {
                          resetSelection();
                          setShowInactive(e.target.checked);
                        }} />
                      퇴원생 보기
                    </label>
                    {current.name !== "" && !renameOpen && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRenameOpen(true);
                          setNewName(current.name);
                          setRenamePreview(null);
                        }}
                      >
                        <Pencil className="size-4 mr-1" />
                        반 이름 변경
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renameOpen && (
                  <div className="rounded-lg border p-3 space-y-3">
                    {!renamePreview ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">새 반 이름</span>
                        <Input className="w-56" value={newName} maxLength={20} onChange={(e) => setNewName(e.target.value)} />
                        <Button size="sm" onClick={handleRenameCheck} disabled={isActing}>
                          {isActing && <Loader2 className="size-4 mr-1 animate-spin" />}
                          확인
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRenameOpen(false)} disabled={isActing}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
                        <span className="text-sm">
                          학생 <b>{renamePreview.studentCount}명</b>(퇴원생 포함)의 반이 <b>{current.name}</b> → <b>{renamePreview.to}</b>(으)로 바뀝니다. 진행할까요?
                        </span>
                        <Button size="sm" onClick={handleRename} disabled={isActing}>
                          {isActing && <Loader2 className="size-4 mr-1 animate-spin" />}
                          바꾸기
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRenamePreview(null)} disabled={isActing}>
                          취소
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* 고른 학생 처리 */}
                {checkedStudents.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                    {!confirm ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{checkedStudents.length}명 선택</span>
                        <span className="mx-1 h-5 border-l" />
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                          value={otherClasses.some((c) => c.name === moveTarget) ? moveTarget : ""}
                          onChange={(e) => setMoveTarget(e.target.value)}
                        >
                          <option value="">옮길 반 고르기</option>
                          {otherClasses.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          className="h-9 w-40 text-sm"
                          placeholder="또는 새 반 이름"
                          maxLength={20}
                          value={moveTarget}
                          onChange={(e) => setMoveTarget(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!moveTarget.trim() || moveTarget.trim() === selected}
                          onClick={() => setConfirm({ kind: "move", to: moveTarget.trim() })}
                        >
                          <ArrowRightLeft className="size-4 mr-1" />
                          반 이동
                        </Button>
                        <span className="mx-1 h-5 border-l" />
                        {checkedActive > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "status", status: "inactive" })}>
                            <UserX className="size-4 mr-1" />
                            퇴원 처리
                          </Button>
                        )}
                        {checkedInactive > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "status", status: "active" })}>
                            <UserCheck className="size-4 mr-1" />
                            복귀
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
                        <span className="text-sm">
                          {confirm.kind === "move" ? (
                            <>
                              학생 <b>{checkedStudents.length}명</b>을 <b>{confirm.to}</b> 반으로 옮깁니다.
                              {!classes.some((c) => c.name === confirm.to && c.listed) && " (새 반은 반 목록에도 추가됩니다)"} 진행할까요?
                            </>
                          ) : confirm.status === "inactive" ? (
                            <>
                              학생 <b>{checkedStudents.length}명</b>을 퇴원 처리합니다. 빌린 책 기록과 카드는 그대로 남습니다. 진행할까요?
                            </>
                          ) : (
                            <>
                              학생 <b>{checkedStudents.length}명</b>을 복귀(재원) 처리합니다. 진행할까요?
                            </>
                          )}
                        </span>
                        <Button size="sm" onClick={handleConfirm} disabled={isActing}>
                          {isActing && <Loader2 className="size-4 mr-1 animate-spin" />}
                          진행
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={isActing}>
                          취소
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {arEnabled && returnsError && <p className="text-sm text-destructive">{returnsError}</p>}

                {isStudentsLoading && students.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : students.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">이 반에 학생이 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input type="checkbox" className="size-4" checked={checked.size === students.length} onChange={toggleAll} aria-label="전체 선택" />
                          </TableHead>
                          <TableHead>이름</TableHead>
                          <TableHead>학년</TableHead>
                          <TableHead>레벨(ZPD)</TableHead>
                          <TableHead>빌린 책 · 반납 예정일</TableHead>
                          {arEnabled && <TableHead>최근 반납(30일) · AR 통과</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s) => (
                          <TableRow key={s.id} className={cn(s.status === "inactive" && "opacity-60")}>
                            <TableCell>
                              <input type="checkbox" className="size-4" checked={checked.has(s.id)} onChange={() => toggle(s.id)} aria-label={`${s.name} 선택`} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Link href={`/admin/residents/${s.id}`} className="font-medium hover:underline">
                                {s.name}
                              </Link>
                              {s.status === "inactive" && (
                                <Badge variant="outline" className="ml-2">
                                  퇴원
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{s.grade === null ? "-" : s.grade === 0 ? "미취학" : `${s.grade}학년`}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {s.zpd_low === null && s.zpd_high === null ? "-" : `${s.zpd_low === null ? "?" : Number(s.zpd_low).toFixed(1)} ~ ${s.zpd_high === null ? "?" : Number(s.zpd_high).toFixed(1)}`}
                            </TableCell>
                            <TableCell>
                              {s.rentals.length === 0 ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <ul className="space-y-1">
                                  {s.rentals.map((r) => (
                                    <li key={r.id} className="flex flex-wrap items-center gap-2">
                                      <Link href={`/admin/books/${r.book_id}`} className="hover:underline">
                                        {r.title}
                                      </Link>
                                      <Badge variant={r.is_overdue ? "destructive" : "outline"} className="shrink-0">
                                        {r.is_overdue ? (
                                          <>
                                            <AlertTriangle className="size-3 mr-1" />
                                            연체 · {shortDate(r.due_date)}
                                          </>
                                        ) : (
                                          `~${shortDate(r.due_date)}`
                                        )}
                                      </Badge>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                            {arEnabled && (
                              <TableCell>
                                {(returnsByUser[s.id] ?? []).length === 0 ? (
                                  <span className="text-muted-foreground">-</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {(returnsByUser[s.id] ?? []).map((r) => (
                                      <li key={r.rental_id} className="flex flex-wrap items-center gap-2">
                                        <Link href={`/admin/books/${r.book_id}`} className="hover:underline">
                                          {r.title}
                                        </Link>
                                        {r.ar_level !== null && (
                                          <span className="font-mono text-xs text-muted-foreground">BL {r.ar_level.toFixed(1)}</span>
                                        )}
                                        <span className="text-xs text-muted-foreground">{shortDate(r.returned_at)} 반납</span>
                                        <ArPassButton
                                          rentalId={r.rental_id}
                                          result={r.result}
                                          onChange={(next) => updateReturnResult(s.id, r.rental_id, next)}
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function AcademyClassesPage() {
  return (
    <AcademyGate>
      <ClassesView />
    </AcademyGate>
  );
}
