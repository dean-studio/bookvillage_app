"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, GraduationCap, Globe } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting } from "@/app/actions/settings";
import { isFlagOn } from "@/lib/site-mode";

function Switch({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ArSettingsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [arOn, setArOn] = useState(false);
  const [openLibraryOn, setOpenLibraryOn] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setArOn(isFlagOn(s, "ar_enabled"));
      setOpenLibraryOn(s.isbn_fallback === "openlibrary");
      setLoaded(true);
    });
  }, []);

  async function save(key: string, value: string) {
    setSaving(key);
    setMsg(null);
    const result = await updateLibrarySetting(key, value);
    setSaving(null);
    if (result.success) {
      setMsg({ type: "success", text: "저장되었습니다." });
      setTimeout(() => setMsg(null), 2000);
    } else {
      setMsg({ type: "error", text: result.error || "저장에 실패했습니다." });
    }
    return result.success;
  }

  async function toggleAr() {
    const next = !arOn;
    setArOn(next);
    const ok = await save("ar_enabled", next ? "on" : "off");
    if (!ok) setArOn(!next);
  }

  async function toggleOpenLibrary() {
    const next = !openLibraryOn;
    setOpenLibraryOn(next);
    const ok = await save("isbn_fallback", next ? "openlibrary" : "none");
    if (!ok) setOpenLibraryOn(!next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/manage")}>
          <ArrowLeft className="size-4 mr-1" />
          관리
        </Button>
        <h1 className="text-2xl font-bold">원서·AR 레벨</h1>
        {saving && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>
      )}

      {!loaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-4" />
                AR 레벨 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">AR 레벨 정보 사용</p>
                  <p className="text-sm text-muted-foreground">
                    도서 등록·수정 화면에 AR 칸(Book Level, Points, Quiz No, Interest)이 생기고,
                    도서 검색에서 레벨로 찾고 레벨순으로 볼 수 있습니다.
                  </p>
                </div>
                <Switch on={arOn} disabled={!!saving} onToggle={toggleAr} />
              </div>
              <p className="text-sm text-muted-foreground">
                끄면 화면에서만 숨겨지고, 이미 입력한 AR 정보는 지워지지 않습니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="size-4" />
                원서 ISBN 보충 조회
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Open Library에서 보충 조회</p>
                  <p className="text-sm text-muted-foreground">
                    바코드(ISBN)로 책 정보를 찾을 때 카카오에 없으면 Open Library(해외 도서 정보)에서 제목·저자·출판사·표지를 가져옵니다. 영어 원서가 많을 때 켜세요.
                  </p>
                </div>
                <Switch on={openLibraryOn} disabled={!!saving} onToggle={toggleOpenLibrary} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
