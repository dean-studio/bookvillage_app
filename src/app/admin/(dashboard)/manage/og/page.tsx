"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, Loader2, Save } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting, uploadOgImage } from "@/app/actions/settings";

export default function OgSettingsPage() {
  const router = useRouter();
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; type: "success" | "error"; text: string } | null>(null);
  const [isUploadingOgImage, startUploadOgImage] = useTransition();

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setOgTitle(s.og_title || "책빌리지");
      setOgDescription(s.og_description || "");
      setOgImageUrl(s.og_image_url || "");
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

  function handleOgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    startUploadOgImage(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadOgImage(formData);
      if (result.success && result.url) {
        setOgImageUrl(result.url);
        setMsg({ key: "og_image_url", type: "success", text: "OG 이미지가 업로드되었습니다." });
        setTimeout(() => setMsg(null), 2000);
      } else {
        setMsg({ key: "og_image_url", type: "error", text: result.error || "OG 이미지 업로드에 실패했습니다." });
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
        <h1 className="text-2xl font-bold">OG 메타데이터</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4" />
            공유 시 표시되는 정보
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
                  <label className="text-sm font-medium">OG 제목</label>
                  <Input
                    type="text"
                    placeholder="책빌리지"
                    value={ogTitle}
                    onChange={(e) => setOgTitle(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("og_title", ogTitle)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "og_title" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "og_title" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">OG 설명</label>
                  <Input
                    type="text"
                    placeholder="아파트 스마트 작은도서관"
                    value={ogDescription}
                    onChange={(e) => setOgDescription(e.target.value)}
                    className="max-w-md"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("og_description", ogDescription)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "og_description" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "og_description" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">OG 이미지</label>
                {ogImageUrl && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <img src={ogImageUrl} alt="OG 이미지" className="max-h-20 object-contain" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleOgImageUpload}
                    disabled={isUploadingOgImage}
                    className="max-w-xs"
                  />
                  {isUploadingOgImage && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">최대 2MB, 1200x630px 권장. 비어있으면 로고 이미지 사용</p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="또는 URL 직접 입력"
                      value={ogImageUrl}
                      onChange={(e) => setOgImageUrl(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave("og_image_url", ogImageUrl)}
                    disabled={savingKey !== null}
                  >
                    {savingKey === "og_image_url" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                    저장
                  </Button>
                </div>
              </div>
              {msg?.key === "og_image_url" && (
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
