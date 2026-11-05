"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, UserPlus, AlertCircle } from "lucide-react";
import { getLibrarySettings } from "@/app/actions/settings";
import { createCardMember } from "@/app/actions/member-cards";
import { parseGroups } from "@/lib/member-card";
import { isAcademy } from "@/lib/site-mode";
import { createAcademyStudent } from "@/app/actions/academy";

export default function NewCardMemberPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 학원 모드에서만: 학년·ZPD (academy_members)
  const [academy, setAcademy] = useState(false);
  const [grade, setGrade] = useState("");
  const [zpdLow, setZpdLow] = useState("");
  const [zpdHigh, setZpdHigh] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getLibrarySettings().then((s) => {
      const list = parseGroups(s.member_groups);
      setGroups(list);
      if (list.length > 0) setGroup(list[0]);
      setAcademy(isAcademy(s.site_type));
    });
  }, []);

  function handleCreate() {
    setError(null);
    if (!group.trim()) {
      setError("반(그룹)을 선택하거나 입력해주세요.");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (academy) {
      startTransition(async () => {
        const result = await createAcademyStudent({ name, group, contact_phone: contactPhone, memo, grade, zpd_low: zpdLow, zpd_high: zpdHigh });
        if (!result.success) {
          setError(result.error ?? "회원 생성에 실패했습니다.");
          return;
        }
        if (result.data?.warning) window.alert(result.data.warning);
        router.push("/admin/residents");
      });
      return;
    }
    startTransition(async () => {
      const result = await createCardMember({ name, group, contact_phone: contactPhone, memo });
      if (!result.success) {
        setError(result.error ?? "회원 생성에 실패했습니다.");
        return;
      }
      router.push("/admin/residents");
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/residents")}>
          <ArrowLeft className="size-4 mr-1" />
          회원 목록
        </Button>
        <h1 className="text-2xl font-bold">회원 추가</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <label className="font-semibold">
              반(그룹) <span className="text-destructive">*</span>
            </label>
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Button
                    key={g}
                    variant={group === g ? "default" : "outline"}
                    className="h-12 px-5 text-lg"
                    onClick={() => setGroup(g)}
                  >
                    {g}
                  </Button>
                ))}
              </div>
            )}
            <Input
              className="h-14 text-lg"
              placeholder="반 이름 직접 입력"
              value={group}
              maxLength={20}
              onChange={(e) => setGroup(e.target.value)}
            />
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                관리 → 로그인·대출 방식에서 반 목록을 등록하면 버튼으로 선택할 수 있어요.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="font-semibold">
              이름 <span className="text-destructive">*</span>
            </label>
            <Input
              className="h-14 text-lg"
              placeholder="예: 김하늘"
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {academy && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="font-semibold">
                  학년 <span className="text-sm font-normal text-muted-foreground">(선택)</span>
                </label>
                <Input
                  className="h-14 text-lg"
                  placeholder="예: 3 (미취학 0)"
                  inputMode="numeric"
                  value={grade}
                  maxLength={2}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="font-semibold">
                  ZPD 하한 <span className="text-sm font-normal text-muted-foreground">(선택)</span>
                </label>
                <Input
                  className="h-14 text-lg"
                  placeholder="예: 2.5"
                  inputMode="decimal"
                  value={zpdLow}
                  maxLength={4}
                  onChange={(e) => setZpdLow(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="font-semibold">
                  ZPD 상한 <span className="text-sm font-normal text-muted-foreground">(선택)</span>
                </label>
                <Input
                  className="h-14 text-lg"
                  placeholder="예: 3.8"
                  inputMode="decimal"
                  value={zpdHigh}
                  maxLength={4}
                  onChange={(e) => setZpdHigh(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="font-semibold">
              보호자 휴대폰 <span className="text-sm font-normal text-muted-foreground">(선택)</span>
            </label>
            <Input
              className="h-14 text-lg"
              placeholder="010-0000-0000"
              inputMode="tel"
              value={contactPhone}
              maxLength={20}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="font-semibold">
              메모 <span className="text-sm font-normal text-muted-foreground">(선택)</span>
            </label>
            <textarea
              className="w-full min-h-28 rounded-md border bg-transparent px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="예: 형제 관계, 알레르기 등"
              value={memo}
              maxLength={500}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="size-5" />
              {error}
            </p>
          )}

          <Button className="h-14 w-full text-lg font-semibold" onClick={handleCreate} disabled={isPending}>
            {isPending ? <Loader2 className="size-5 mr-1 animate-spin" /> : <UserPlus className="size-5 mr-1" />}
            회원 등록 (QR 카드 발급)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
