"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Loader2, Save } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting, uploadLogo } from "@/app/actions/settings";

export default function SiteSettingsPage() {
  const router = useRouter();
  const [apartmentName, setApartmentName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; type: "success" | "error"; text: string } | null>(null);
  const [isUploadingLogo, startUploadLogo] = useTransition();

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setApartmentName(s.apartment_name || "");
      setLogoUrl(s.logo_url || "");
      setLoaded(true);
    });
  }, []);

  async function handleSave(key: string, value: string) {
    setMsg(null);
    setSavingKey(key);
    const result = await updateLibrarySetting(key, value);
    setSavingKey(null);
    if (result.success) {
      setMsg({ key, type: "success", text: "저장되었습니다." });
      setTimeout(() => setMsg(null), 2000);
    } else {
      setMsg({ key, type: "error", text: result.error || "저장에 실패했습니다." });
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    startUploadLogo(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadLogo(formData);
      if (result.success && result.url) {
        setLogoUrl(result.url);
        setMsg({ key: "logo_url", type: "success", text: "로고가 업로드되었습니다." });
        setTimeout(() => setMsg(null), 2000);
      } else {
        setMsg({ key: "logo_url", type: "error", text: result.error || "로고 업로드에 실패했습니다." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/manage")}>
          <ArrowLeft className="size-4 mr-1" />
          관리
        </Button>
        <h1 className="text-2xl font-bold">사이트 기본정보</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" />
            도서관 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">아파트 이름</label>
                  <Input
                    type="text"
                    placeholder="예: 책마을아파트"
                    value={apartmentName}
                    onChange={(e) => setApartmentName(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("apartment_name", apartmentName)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "apartment_name" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "apartment_name" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">로고 이미지</label>
                {logoUrl && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <img src={logoUrl} alt="현재 로고" className="max-h-20 object-contain" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="max-w-xs"
                  />
                  {isUploadingLogo && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">최대 2MB, PNG/JPG 권장</p>
              </div>
              {msg?.key === "logo_url" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
