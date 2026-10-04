"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  User,
  Phone,
  Home,
  Calendar,
  Loader2,
  BookOpen,
  AlertTriangle,
  Candy,
  Plus,
  Minus,
  KeyRound,
  QrCode,
  Printer,
  RefreshCw,
  Pencil,
  StickyNote,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { getResidentDetail } from "@/app/actions/rentals";
import { adminResetResidentPin } from "@/app/actions/auth";
import { reissueMemberCard, updateCardMemberInfo } from "@/app/actions/member-cards";
import { isMemberCardCode } from "@/lib/member-card";
import { QrCodeSvg } from "@/components/qr-code";
import { getUserJellyHistory, adminGiveJelly, adminDeductJelly } from "@/app/actions/jelly";

type ResidentData = NonNullable<Awaited<ReturnType<typeof getResidentDetail>>>;

export default function AdminResidentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [data, setData] = useState<ResidentData | null>(null);
  const [isLoading, startTransition] = useTransition();

  // Jelly state
  type JellyHistoryItem = { id: string; amount: number; reason: string; description: string | null; book_title: string | null; created_at: string };
  const [jellyBalance, setJellyBalance] = useState<number | null>(null);
  const [jellyHistory, setJellyHistory] = useState<JellyHistoryItem[]>([]);
  const [isJellyLoaded, setIsJellyLoaded] = useState(false);
  const [isJellyLoading, startJellyTransition] = useTransition();
  const [jellyAmount, setJellyAmount] = useState("");
  const [jellyDesc, setJellyDesc] = useState("");
  const [jellyMsg, setJellyMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isJellyAction, startJellyAction] = useTransition();

  // PIN 재설정 state
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPinAction, startPinAction] = useTransition();

  function handleResetPin() {
    if (!/^\d{4}$/.test(newPin)) {
      setPinMsg({ type: "error", text: "숫자 4자리를 입력하세요." });
      return;
    }
    setPinMsg(null);
    startPinAction(async () => {
      const result = await adminResetResidentPin(userId, newPin);
      if (result.success) {
        setPinMsg({ type: "success", text: `비밀번호가 ${newPin}(으)로 재설정되었습니다.` });
        setNewPin("");
      } else {
        setPinMsg({ type: "error", text: result.error || "재설정 실패" });
      }
    });
  }

  // QR 회원카드 재발급 state
  const [reissueConfirm, setReissueConfirm] = useState(false);
  const [cardMsg, setCardMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCardAction, startCardAction] = useTransition();

  // 카드 회원 정보 수정 state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", group: "", contact_phone: "", memo: "" });
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function startEdit() {
    if (!data) return;
    const p = data.profile;
    setForm({ name: p.name, group: p.dong_ho, contact_phone: p.contact_phone ?? "", memo: p.memo ?? "" });
    setEditMsg(null);
    setEditing(true);
  }

  function handleSaveInfo() {
    setEditMsg(null);
    startSaving(async () => {
      const result = await updateCardMemberInfo(userId, form);
      if (!result.success) {
        setEditMsg(result.error || "저장 실패");
        return;
      }
      const fresh = await getResidentDetail(userId);
      if (fresh) setData(fresh);
      setEditing(false);
    });
  }

  function handleReissue() {
    setCardMsg(null);
    startCardAction(async () => {
      const result = await reissueMemberCard(userId);
      setReissueConfirm(false);
      if (result.success && result.data) {
        const code = result.data.code;
        setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, phone_number: code } } : prev));
        setCardMsg({ type: "success", text: "새 카드가 발급되었습니다. 기존 카드는 더 이상 사용할 수 없습니다." });
      } else {
        setCardMsg({ type: "error", text: result.error || "재발급 실패" });
      }
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const result = await getResidentDetail(userId);
      if (result) setData(result);
    });
  }, [userId]);

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ChevronLeft className="size-4 mr-1" /> 뒤로
        </Button>
        <p className="text-center text-muted-foreground py-8">회원 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const { profile, active_rentals, past_rentals } = data;
  const isCardMember = isMemberCardCode(profile.phone_number);

  function loadJelly() {
    startJellyTransition(async () => {
      const history = await getUserJellyHistory(userId);
      setJellyHistory(history as JellyHistoryItem[]);
      // Calculate balance from first entry's running total or sum
      // We'll fetch it from the balances via a simple approach
      const total = history.reduce((sum: number, h: JellyHistoryItem) => sum + h.amount, 0);
      setJellyBalance(total);
      setIsJellyLoaded(true);
    });
  }

  function handleJellyGive() {
    const amt = parseInt(jellyAmount, 10);
    if (!amt || amt <= 0 || !jellyDesc.trim()) return;
    setJellyMsg(null);
    startJellyAction(async () => {
      const result = await adminGiveJelly(userId, amt, jellyDesc.trim());
      if (result.success) {
        setJellyMsg({ type: "success", text: `${amt} 젤리 지급 완료` });
        setJellyAmount("");
        setJellyDesc("");
        loadJelly();
        setTimeout(() => setJellyMsg(null), 2000);
      } else {
        setJellyMsg({ type: "error", text: result.error || "지급 실패" });
      }
    });
  }

  function handleJellyDeduct() {
    const amt = parseInt(jellyAmount, 10);
    if (!amt || amt <= 0 || !jellyDesc.trim()) return;
    setJellyMsg(null);
    startJellyAction(async () => {
      const result = await adminDeductJelly(userId, amt, jellyDesc.trim());
      if (result.success) {
        setJellyMsg({ type: "success", text: `${amt} 젤리 차감 완료` });
        setJellyAmount("");
        setJellyDesc("");
        loadJelly();
        setTimeout(() => setJellyMsg(null), 2000);
      } else {
        setJellyMsg({ type: "error", text: result.error || "차감 실패" });
      }
    });
  }

  function jellyReasonLabel(reason: string): string {
    switch (reason) {
      case "checkout": return "도서 대출";
      case "return": return "도서 반납";
      case "report": return "독서록 작성";
      case "quiz": return "퀴즈 정답";
      case "admin_give": return "관리자 지급";
      case "admin_deduct": return "관리자 차감";
      default: return reason;
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ChevronLeft className="size-4 mr-1" /> 뒤로
      </Button>

      {/* 회원 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="size-5" />
            회원 정보
            {isCardMember && !editing && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={startEdit}>
                <Pencil className="size-4 mr-1" />
                수정
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4 max-w-xl">
              {([
                ["name", "이름", 20],
                ["group", "반(소속)", 20],
                ["contact_phone", "보호자 휴대폰 (선택)", 20],
              ] as const).map(([key, label, max]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium">{label}</label>
                  <Input
                    className="h-12 text-lg"
                    value={form[key]}
                    maxLength={max}
                    inputMode={key === "contact_phone" ? "tel" : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">메모 (선택)</label>
                <textarea
                  className="w-full min-h-24 rounded-md border bg-transparent px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.memo}
                  maxLength={500}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                />
              </div>
              {editMsg && <p className="text-sm text-destructive">{editMsg}</p>}
              <div className="flex gap-2">
                <Button onClick={handleSaveInfo} disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 mr-1 animate-spin" />}
                  저장
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={isSaving}>
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">이름</p>
                  <p className="font-semibold">{profile.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Home className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{isCardMember ? "반(소속)" : "동/호수"}</p>
                  <p className="font-semibold">{profile.dong_ho}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{isCardMember ? "카드 코드" : "연락처"}</p>
                  <p className="font-mono">{profile.phone_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">가입일</p>
                  <p>{new Date(profile.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
                </div>
              </div>
              {isCardMember && (
                <>
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">보호자 휴대폰</p>
                      <p className="font-mono">{profile.contact_phone || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 col-span-2">
                    <StickyNote className="size-4 text-muted-foreground mt-1" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">메모</p>
                      <p className="whitespace-pre-wrap break-words">{profile.memo || "-"}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR 회원카드 */}
      {isCardMember && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4" />
              QR 회원카드
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <QrCodeSvg value={profile.phone_number} className="size-32 rounded border bg-white p-1" />
              <div className="space-y-2">
                <Button onClick={() => router.push(`/admin/residents/cards?ids=${profile.id}`)}>
                  <Printer className="size-4 mr-1" />
                  카드 인쇄
                </Button>
                <p className="text-sm text-muted-foreground">같은 카드를 다시 인쇄합니다. 기존 카드도 계속 사용할 수 있어요.</p>
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              {!reissueConfirm ? (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setReissueConfirm(true)}>
                  <RefreshCw className="size-4 mr-1" />
                  카드 재발급 (분실 시)
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <span className="text-sm">새 코드로 재발급하면 <b>기존 카드는 사용할 수 없습니다.</b> 진행할까요?</span>
                  <Button size="sm" variant="destructive" onClick={handleReissue} disabled={isCardAction}>
                    {isCardAction && <Loader2 className="size-4 mr-1 animate-spin" />}
                    재발급
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReissueConfirm(false)} disabled={isCardAction}>
                    취소
                  </Button>
                </div>
              )}
              {cardMsg && (
                <p className={`text-sm ${cardMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>{cardMsg.text}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 비밀번호(PIN) 재설정 */}
      {!isCardMember && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" />
              비밀번호(PIN) 재설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              비밀번호는 암호화되어 저장되므로 조회할 수 없습니다. 주민이 비밀번호를 잊은 경우 새 PIN 4자리로 재설정해 주세요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="새 PIN 4자리"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-40 font-mono tracking-widest text-lg"
              />
              <Button onClick={handleResetPin} disabled={isPinAction || newPin.length !== 4}>
                {isPinAction ? <Loader2 className="size-4 mr-1 animate-spin" /> : <KeyRound className="size-4 mr-1" />}
                재설정
              </Button>
            </div>
            {pinMsg && (
              <p className={`text-sm ${pinMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                {pinMsg.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 현재 대출 중 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            대출 중
            <Badge variant="secondary" className="ml-1">{active_rentals.length}권</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {active_rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">대출 중인 도서가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {active_rentals.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/books/${r.book.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.book.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.book.barcode} · 대출: {new Date(r.rented_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </p>
                  </div>
                  <Badge variant={r.is_overdue ? "destructive" : "outline"} className="shrink-0 ml-2">
                    {r.is_overdue ? (
                      <><AlertTriangle className="size-3 mr-1" />연체</>
                    ) : (
                      `~${new Date(r.due_date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" })}`
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 젤리 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Candy className="size-4 text-yellow-500" />
            젤리
            {jellyBalance !== null && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600 ml-1">
                {jellyBalance} 젤리
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isJellyLoaded ? (
            <Button variant="outline" className="w-full" onClick={loadJelly} disabled={isJellyLoading}>
              {isJellyLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Candy className="size-4 mr-2" />}
              젤리 현황 보기
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Give/Deduct */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="수량"
                    value={jellyAmount}
                    onChange={(e) => setJellyAmount(e.target.value)}
                    className="w-28 h-11"
                    min={1}
                  />
                  <Input
                    placeholder="사유 (필수)"
                    value={jellyDesc}
                    onChange={(e) => setJellyDesc(e.target.value)}
                    className="flex-1 h-11"
                  />
                </div>
                {(!jellyAmount || !jellyDesc.trim()) && (
                  <p className="text-xs text-muted-foreground">수량과 사유를 모두 입력해야 지급/차감이 가능합니다.</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleJellyGive} disabled={isJellyAction || !jellyAmount || !jellyDesc.trim()} className="flex-1 h-11">
                    <Plus className="size-4 mr-1.5" />
                    지급
                  </Button>
                  <Button variant="destructive" onClick={handleJellyDeduct} disabled={isJellyAction || !jellyAmount || !jellyDesc.trim()} className="flex-1 h-11">
                    <Minus className="size-4 mr-1.5" />
                    차감
                  </Button>
                </div>
                {jellyMsg && (
                  <p className={`text-sm font-medium ${jellyMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                    {jellyMsg.text}
                  </p>
                )}
              </div>

              {/* History */}
              {jellyHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">젤리 이력이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {jellyHistory.map((h) => (
                    <div key={h.id} className="border rounded-lg p-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{jellyReasonLabel(h.reason)}</p>
                        {(h.book_title || h.description) && (
                          <p className="text-xs text-muted-foreground truncate">{h.book_title || h.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ml-2 ${h.amount > 0 ? "text-yellow-600" : "text-destructive"}`}>
                        {h.amount > 0 ? "+" : ""}{h.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 반납 이력 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            대출 이력
            <span className="text-sm font-normal text-muted-foreground">
              (최근 {past_rentals.length}건)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {past_rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">반납 이력이 없습니다.</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>도서명</TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead>대출일</TableHead>
                      <TableHead>반납예정일</TableHead>
                      <TableHead className="text-right">반납일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {past_rentals.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/admin/books/${r.book.id}`)}
                      >
                        <TableCell className="font-medium">{r.book.title}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{r.book.barcode}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.rented_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.due_date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.returned_at ? new Date(r.returned_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-2">
                {past_rentals.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 space-y-1 cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/books/${r.book.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{r.book.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        반납: {r.returned_at ? new Date(r.returned_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.book.barcode} · {new Date(r.rented_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} ~ {new Date(r.due_date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
