"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings, Loader2, Save } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting } from "@/app/actions/settings";

export default function LibrarySettingsPage() {
  const router = useRouter();
  const [maxRentals, setMaxRentals] = useState("");
  const [rentalDays, setRentalDays] = useState("");
  const [newBookDays, setNewBookDays] = useState("");
  const [featuredDuration, setFeaturedDuration] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setMaxRentals(s.max_rentals || "5");
      setRentalDays(s.rental_days || "14");
      setNewBookDays(s.new_book_days || "30");
      setFeaturedDuration(s.featured_duration_days || "14");
      setLoaded(true);
    });
  }, []);

  async function handleSave(key: string, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    if (key === "max_rentals" && (num < 1 || num > 20)) return;
    if (key === "rental_days" && (num < 1 || num > 90)) return;
    if (key === "new_book_days" && (num < 1 || num > 365)) return;
    if (key === "featured_duration_days" && (num < 1 || num > 90)) return;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/manage")}>
          <ArrowLeft className="size-4 mr-1" />
          관리
        </Button>
        <h1 className="text-2xl font-bold">도서관 설정</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4" />
            대출 설정
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
                  <label className="text-sm font-medium">최대 대출 권수</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={maxRentals}
                    onChange={(e) => setMaxRentals(e.target.value)}
                    className="w-24"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("max_rentals", maxRentals)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "max_rentals" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "max_rentals" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">기본 대출 기간</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={rentalDays}
                      onChange={(e) => setRentalDays(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">일</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("rental_days", rentalDays)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "rental_days" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "rental_days" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <div className="border-t pt-4 mt-2" />
              <p className="text-sm font-medium text-muted-foreground">신작 도서 설정</p>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">신작 기준 일수</label>
                  <p className="text-xs text-muted-foreground">등록일 기준 이 기간 이내 도서를 신작으로 표시</p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={newBookDays}
                      onChange={(e) => setNewBookDays(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">일</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("new_book_days", newBookDays)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "new_book_days" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "new_book_days" && (
                <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">수동 신작 지정 유지 기간</label>
                  <p className="text-xs text-muted-foreground">수동으로 신작 지정 시 이 기간 후 자동 해제</p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={featuredDuration}
                      onChange={(e) => setFeaturedDuration(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">일</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave("featured_duration_days", featuredDuration)}
                  disabled={savingKey !== null}
                >
                  {savingKey === "featured_duration_days" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
                  저장
                </Button>
              </div>
              {msg?.key === "featured_duration_days" && (
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
