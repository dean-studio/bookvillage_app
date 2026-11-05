"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Printer, QrCode } from "lucide-react";
import { QrCodeSvg } from "@/components/qr-code";
import { getCardMembers } from "@/app/actions/member-cards";
import { getPublicSettings } from "@/app/actions/settings";
import { getInactiveStudentIds } from "@/app/actions/academy";
import { isAcademy } from "@/lib/site-mode";

type Member = Awaited<ReturnType<typeof getCardMembers>>[number];

function MemberCardPrint() {
  const router = useRouter();
  const params = useSearchParams();
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  // 학원 모드에서만 채운다: 퇴원생 id (아파트·유치원 등은 비어 있어 목록이 그대로)
  const [inactiveIds, setInactiveIds] = useState<Set<string>>(new Set());
  const [academyMode, setAcademyMode] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [group, setGroup] = useState("전체");
  const [loaded, setLoaded] = useState(false);
  const [libraryName, setLibraryName] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo.png");

  useEffect(() => {
    Promise.all([getCardMembers(), getPublicSettings()]).then(async ([list, settings]) => {
      // ?ids=a,b → 해당 회원만 선택 (회원 상세/추가 후 바로 인쇄)
      const ids = params.get("ids")?.split(",").filter(Boolean);
      // 학원 모드일 때만 퇴원생을 읽어 기본으로 뺀다 (다른 모드는 추가 요청 없음)
      if (isAcademy(settings.site_type)) {
        const res = await getInactiveStudentIds();
        const inactive = new Set(res.success ? res.data?.ids ?? [] : []);
        setAcademyMode(true);
        setInactiveIds(inactive);
        // 퇴원생을 콕 집어 인쇄하러 온 경우(?ids=)에는 퇴원생도 보이게
        if (ids?.some((id) => inactive.has(id))) setIncludeInactive(true);
      }
      setAllMembers(list);
      setLibraryName(settings.apartment_name || "작은도서관");
      if (settings.logo_url) setLogoUrl(settings.logo_url);
      setSelected(new Set(ids && ids.length > 0 ? ids : list.map((m) => m.id)));
      setLoaded(true);
    });
  }, [params]);

  const members = useMemo(
    () => (academyMode && !includeInactive ? allMembers.filter((m) => !inactiveIds.has(m.id)) : allMembers),
    [allMembers, academyMode, includeInactive, inactiveIds]
  );
  const hiddenInactive = allMembers.length - members.length;

  const groups = useMemo(() => ["전체", ...Array.from(new Set(members.map((m) => m.dong_ho)))], [members]);
  const visible = group === "전체" ? members : members.filter((m) => m.dong_ho === group);
  // 선택한 반 탭 안에서 체크된 회원만 인쇄 (반 탭 = 반별 일괄 인쇄)
  const toPrint = visible.filter((m) => selected.has(m.id));
  const countOf = (g: string) => (g === "전체" ? members.length : members.filter((m) => m.dong_ho === g).length);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of visible) {
        if (on) next.add(m.id);
        else next.delete(m.id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/residents")}>
            <ArrowLeft className="size-4 mr-1" />
            회원 목록
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="size-6" />
            회원카드 인쇄
          </h1>
        </div>
        <Button onClick={() => window.print()} disabled={toPrint.length === 0}>
          <Printer className="size-4 mr-1" />
          {toPrint.length}장 인쇄
        </Button>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : allMembers.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 print:hidden">
          카드 회원이 없습니다. 회원 목록에서 회원을 추가하세요.
        </p>
      ) : (
        <>
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">인쇄할 회원 선택</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Button key={g} size="sm" variant={group === g ? "default" : "outline"} onClick={() => setGroup(g)}>
                    {g} ({countOf(g)})
                  </Button>
                ))}
              </div>
              {academyMode && inactiveIds.size > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                  퇴원생 포함
                  {!includeInactive && hiddenInactive > 0 && (
                    <span className="text-muted-foreground">(퇴원생 {hiddenInactive}명은 목록에서 뺐습니다)</span>
                  )}
                </label>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => selectVisible(true)}>모두 선택</Button>
                <Button size="sm" variant="ghost" onClick={() => selectVisible(false)}>모두 해제</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {visible.map((m) => (
                  <label
                    key={m.id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${
                      selected.has(m.id) ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                    <span className="font-medium">{m.name}</span>
                    <Badge variant="secondary">{m.dong_ho}</Badge>
                    {academyMode && inactiveIds.has(m.id) && <Badge variant="outline">퇴원</Badge>}
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                A4 한 장에 10장(85×50mm)씩 인쇄됩니다. 테두리선을 따라 잘라 코팅하면 오래 쓸 수 있어요.
              </p>
            </CardContent>
          </Card>

          <div className="member-card-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
            {toPrint.map((m) => (
              <div key={m.id} className="member-card flex items-center gap-3 rounded-xl border bg-white p-3 text-black">
                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img src={logoUrl} alt="" className="member-card-logo h-6 w-auto object-contain" />
                    <span className="text-xs font-semibold truncate">{libraryName}</span>
                  </div>
                  <div>
                    <p className="member-card-name text-2xl font-bold leading-tight break-keep">{m.name}</p>
                    <p className="member-card-group text-sm text-neutral-600">{m.dong_ho}</p>
                  </div>
                  <p className="text-[10px] text-neutral-500">도서관 회원카드</p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <QrCodeSvg value={m.phone_number} className="member-card-qr size-28" />
                  <span className="font-mono text-[9px] text-neutral-500">{m.phone_number}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MemberCardPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <MemberCardPrint />
    </Suspense>
  );
}
