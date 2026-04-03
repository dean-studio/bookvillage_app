"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, GraduationCap, TreePine, Loader2, Check } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting } from "@/app/actions/settings";

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
] as const;

export default function SiteTypePage() {
  const router = useRouter();
  const [siteType, setSiteType] = useState("apartment");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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
    await updateLibrarySetting("site_type", value);
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {saving && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          저장 중...
        </div>
      )}
    </div>
  );
}
