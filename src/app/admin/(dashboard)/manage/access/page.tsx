"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, QrCode, Smartphone, UserPlus, ScanBarcode, Users, X, Plus, Check } from "lucide-react";
import { getLibrarySettings, updateLibrarySetting } from "@/app/actions/settings";
import { parseGroups } from "@/lib/member-card";

type Option = { value: string; label: string; desc: string; icon: typeof QrCode };

const LOGIN_OPTIONS: Option[] = [
  { value: "pin", label: "휴대폰 + PIN", desc: "동/호수와 비밀번호 4자리로 로그인", icon: Smartphone },
  { value: "qr", label: "QR 회원카드", desc: "관리자가 발급한 QR 카드를 리더기에 찍어 로그인", icon: QrCode },
];

const SIGNUP_OPTIONS: Option[] = [
  { value: "self", label: "본인 가입 허용", desc: "주민이 직접 회원가입", icon: UserPlus },
  { value: "admin_only", label: "관리자만 생성", desc: "회원 목록에서 관리자가 등록", icon: Users },
];

function OptionCards({
  options,
  value,
  disabled,
  onSelect,
}: {
  options: Option[];
  value: string;
  disabled?: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            disabled={disabled}
            className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <o.icon className={`size-7 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
            <div className="min-w-0">
              <p className={`font-bold ${selected ? "text-primary" : ""}`}>{o.label}</p>
              <p className="text-sm text-muted-foreground">{o.desc}</p>
            </div>
            {selected && (
              <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5">
                <Check className="size-3.5 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function AccessSettingsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [loginMethod, setLoginMethod] = useState("pin");
  const [signupMode, setSignupMode] = useState("self");
  const [kioskMode, setKioskMode] = useState("off");
  const [logoutSec, setLogoutSec] = useState("30");
  const [groups, setGroups] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getLibrarySettings().then((s) => {
      setLoginMethod(s.login_method || "pin");
      setSignupMode(s.signup_mode || "self");
      setKioskMode(s.kiosk_mode || "off");
      setLogoutSec(s.kiosk_logout_sec || "30");
      setGroups(parseGroups(s.member_groups));
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

  async function handleLoginMethod(v: string) {
    if (v === loginMethod) return;
    setLoginMethod(v);
    await save("login_method", v);
    // QR 카드는 관리자가 발급해야 하므로 본인 가입을 막는다
    if (v === "qr" && signupMode !== "admin_only") {
      setSignupMode("admin_only");
      await save("signup_mode", "admin_only");
    }
  }

  async function handleSignupMode(v: string) {
    if (v === signupMode) return;
    setSignupMode(v);
    await save("signup_mode", v);
  }

  async function toggleKiosk() {
    const next = kioskMode === "on" ? "off" : "on";
    setKioskMode(next);
    await save("kiosk_mode", next);
  }

  async function saveLogoutSec() {
    const n = parseInt(logoutSec, 10);
    if (isNaN(n) || n < 10 || n > 300) {
      setMsg({ type: "error", text: "자동 종료 시간은 10~300초 사이로 입력하세요." });
      return;
    }
    await save("kiosk_logout_sec", String(n));
  }

  async function saveGroups(next: string[]) {
    setGroups(next);
    await save("member_groups", JSON.stringify(next));
  }

  function addGroup() {
    const g = newGroup.trim();
    if (!g || g.length > 20 || groups.includes(g)) return;
    setNewGroup("");
    saveGroups([...groups, g]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/manage")}>
          <ArrowLeft className="size-4 mr-1" />
          관리
        </Button>
        <h1 className="text-2xl font-bold">로그인·대출 방식</h1>
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
              <CardTitle className="text-base">로그인 방식</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <OptionCards options={LOGIN_OPTIONS} value={loginMethod} disabled={!!saving} onSelect={handleLoginMethod} />
              {loginMethod === "qr" && (
                <p className="text-sm text-muted-foreground">
                  QR 카드는 <b>회원 목록 → 회원 추가</b>에서 발급하고 <b>카드 인쇄</b>로 출력하세요. 리더기는 QR을 읽을 수 있는 2D 리더기가 필요합니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">회원 가입</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <OptionCards
                options={SIGNUP_OPTIONS}
                value={signupMode}
                disabled={!!saving || loginMethod === "qr"}
                onSelect={handleSignupMode}
              />
              {loginMethod === "qr" && (
                <p className="text-sm text-muted-foreground">QR 카드 방식에서는 관리자만 회원을 생성할 수 있습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanBarcode className="size-4" />
                홈 화면 리더기 대출
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">홈 화면을 리더기 대기 화면으로 사용</p>
                  <p className="text-sm text-muted-foreground">
                    회원카드 찍기 → 책 바코드 찍기 → 자동 대출. 일정 시간 입력이 없으면 자동으로 로그아웃됩니다.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={kioskMode === "on"}
                  onClick={toggleKiosk}
                  disabled={!!saving}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                    kioskMode === "on" ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${
                      kioskMode === "on" ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {kioskMode === "on" && loginMethod !== "qr" && (
                <p className="text-sm text-amber-600">홈 화면 리더기 대출은 QR 회원카드로 로그인합니다. 카드 회원을 먼저 등록하세요.</p>
              )}
              <div className="flex items-end gap-2">
                <div className="space-y-1.5 w-40">
                  <label className="text-sm font-medium">자동 종료 (초)</label>
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={logoutSec}
                    onChange={(e) => setLogoutSec(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </div>
                <Button variant="outline" onClick={saveLogoutSec} disabled={!!saving}>
                  저장
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                반(그룹) 목록
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">회원 추가 시 선택할 반 이름입니다. 예: 햇님반, 달님반</p>
              <div className="flex flex-wrap gap-2">
                {groups.length === 0 && <span className="text-sm text-muted-foreground">등록된 반이 없습니다.</span>}
                {groups.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 pl-3 pr-1 py-1">
                    {g}
                    <button
                      onClick={() => saveGroups(groups.filter((x) => x !== g))}
                      className="p-0.5 rounded-full hover:bg-background"
                      aria-label={`${g} 삭제`}
                    >
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm">
                <Input
                  placeholder="반 이름"
                  value={newGroup}
                  maxLength={20}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) addGroup();
                  }}
                />
                <Button onClick={addGroup} disabled={!newGroup.trim() || !!saving}>
                  <Plus className="size-4 mr-1" />
                  추가
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
