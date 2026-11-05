"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, GraduationCap, TreePine, Baby, NotebookPen, Loader2, Check } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting } from "@/app/actions/settings";
import { isAcademy, isKindergarten } from "@/lib/site-mode";

const SITE_TYPES = [
  {
    value: "apartment",
    label: "아파트",
    desc: "동/호수로 주민을 구분합니다",
    example: "예: 101동 1201호",
    icon: Building2,
  },
  {
    value: "school",
    label: "학교",
    desc: "학년/반으로 학생을 구분합니다",
    example: "예: 3학년 2반",
    icon: GraduationCap,
  },
  {
    value: "village",
    label: "마을",
    desc: "지번으로 주민을 구분합니다",
    example: "예: 300-3",
    icon: TreePine,
  },
  {
    value: "kindergarten",
    label: "유치원",
    desc: "반으로 아이를 구분하고 QR 회원카드로 대출합니다",
    example: "예: 햇님반",
    icon: Baby,
  },
  {
    value: "academy",
    label: "학원",
    desc: "반으로 학생을 구분하고 QR 회원카드로 대출합니다",
    example: "예: 영어 A반",
    icon: NotebookPen,
  },
] as const;

// 유치원 선택 시 함께 적용되는 로그인·대출 방식 (이후 개별 변경 가능)
const KINDERGARTEN_PRESET: Record<string, string> = {
  login_method: "qr",
  signup_mode: "admin_only",
  kiosk_mode: "on",
};

// 학원 선택 시 함께 적용되는 설정 (이후 개별 변경 가능). 학원을 고른 순간에만 저장한다.
const ACADEMY_PRESET: Record<string, string> = {
  login_method: "qr",
  signup_mode: "admin_only",
  kiosk_mode: "off",
  rental_days: "7",
  ar_enabled: "on",
  isbn_fallback: "openlibrary",
};

export default function SiteTypePage() {
  const router = useRouter();
  const [siteType, setSiteType] = useState("apartment");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presetApplied, setPresetApplied] = useState<"kindergarten" | "academy" | null>(null);

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setSiteType(s.site_type || "apartment");
      setLoaded(true);
    });
  }, []);

  async function handleSelect(value: string) {
    if (value === siteType) return;
    setSaving(true);
    setSiteType(value);
    setPresetApplied(null);
    await updateLibrarySetting("site_type", value);
    if (isKindergarten(value)) {
      for (const [key, v] of Object.entries(KINDERGARTEN_PRESET)) {
        await updateLibrarySetting(key, v);
      }
      setPresetApplied("kindergarten");
    } else if (isAcademy(value)) {
      for (const [key, v] of Object.entries(ACADEMY_PRESET)) {
        await updateLibrarySetting(key, v);
      }
      setPresetApplied("academy");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/manage")}>
          <ArrowLeft className="size-4 mr-1" />
          관리
        </Button>
        <h1 className="text-2xl font-bold">사이트 유형</h1>
      </div>

      <p className="text-muted-foreground">
        도서관이 운영되는 기관 유형을 선택하세요. 주민 회원가입 시 주소 입력 방식이 변경됩니다.
      </p>

      {!loaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {SITE_TYPES.map((t) => {
            const isSelected = siteType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => handleSelect(t.value)}
                disabled={saving}
                className={`relative flex flex-col items-center gap-4 rounded-xl border-2 p-8 transition-all text-left ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                } ${saving ? "opacity-60" : ""}`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 rounded-full bg-primary p-1">
                    <Check className="size-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`rounded-2xl p-4 ${isSelected ? "bg-primary/15" : "bg-muted"}`}>
                  <t.icon className={`size-10 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center space-y-1.5">
                  <p className={`text-xl font-bold ${isSelected ? "text-primary" : ""}`}>
                    {t.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                  <p className="text-xs text-muted-foreground/70">{t.example}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {presetApplied === "kindergarten" && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm space-y-2">
          <p className="font-semibold">로그인·대출 방식이 유치원용으로 함께 설정되었습니다.</p>
          <p className="text-muted-foreground">QR 회원카드 로그인 · 관리자만 회원 생성 · 홈 화면 리더기 대출 ON</p>
          <Button size="sm" variant="outline" onClick={() => router.push("/admin/manage/access")}>
            로그인·대출 방식 확인
          </Button>
        </div>
      )}

      {presetApplied === "academy" && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm space-y-2">
          <p className="font-semibold">로그인·대출 방식이 학원용으로 함께 설정되었습니다.</p>
          <p className="text-muted-foreground">
            QR 회원카드 로그인 · 관리자만 회원 생성 · 홈 화면 리더기 대출 OFF · 대출 기간 7일 · AR 정보 사용 · ISBN 보충 조회(Open Library) 사용
          </p>
          <p className="text-muted-foreground">다른 유형으로 바꿔도 이 설정은 그대로 남습니다. 필요하면 각 설정 화면에서 바꿔 주세요.</p>
          <Button size="sm" variant="outline" onClick={() => router.push("/admin/manage/access")}>
            로그인·대출 방식 확인
          </Button>
        </div>
      )}

      {saving && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          저장 중...
        </div>
      )}
    </div>
  );
}
