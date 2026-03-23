"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Candy, Loader2, Save } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting } from "@/app/actions/settings";

export default function JellySettingsPage() {
  const router = useRouter();
  const [jellyCheckout, setJellyCheckout] = useState("");
  const [jellyReturn, setJellyReturn] = useState("");
  const [jellyReport, setJellyReport] = useState("");
  const [jellyQuiz, setJellyQuiz] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setJellyCheckout(s.jelly_checkout || "5");
      setJellyReturn(s.jelly_return || "5");
      setJellyReport(s.jelly_report || "10");
      setJellyQuiz(s.jelly_quiz || "3");
      setLoaded(true);
    });
  }, []);

  async function handleSave(key: string, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 100) return;

    setMsg(null);
    setSavingKey(key);
    const result = await updateLibrarySetting(key, String(num));
    setSavingKey(null);
    if (result.success) {
      setMsg({ key, type: "success", text: "저장되었습니다." });
      setTimeout(() => setMsg(null), 2000);
    } else {
      setMsg({ key, type: "error", text: result.error || "저장에 실패했습니다." });
    }
  }

  const items = [
    { key: "jelly_checkout", label: "도서 대출", value: jellyCheckout, setter: setJellyCheckout },
    { key: "jelly_return", label: "도서 반납", value: jellyReturn, setter: setJellyReturn },
    { key: "jelly_report", label: "독서록 작성", value: jellyReport, setter: setJellyReport },
    { key: "jelly_quiz", label: "퀴즈 정답", value: jellyQuiz, setter: setJellyQuiz },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/manage")}>
          <ArrowLeft className="size-4 mr-1" />
          관리
        </Button>
        <h1 className="text-2xl font-bold">젤리 포인트 설정</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Candy className="size-4 text-yellow-500" />
            활동별 젤리 지급량
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            items.map(({ key, label, value, setter }) => (
              <div key={key}>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-sm font-medium">{label} 시 지급 젤리</label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">젤리</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(key, value)}
                    disabled={savingKey !== null}
                  >
                    {savingKey === key ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                    저장
                  </Button>
                </div>
                {msg?.key === key && (
                  <p className={`text-xs mt-1 ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                    {msg.text}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
