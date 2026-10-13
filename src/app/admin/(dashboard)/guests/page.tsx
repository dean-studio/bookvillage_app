"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, UserRound, UserPlus, Copy, Merge, Trash2, ChevronRight, AlertCircle, ArrowRight } from "lucide-react";
import {
  getGuestList,
  getGuestRentals,
  updateGuest,
  mergeGuests,
  deleteGuest,
  type GuestRow,
  type GuestRental,
} from "@/app/actions/guests";

// 01012345678 -> 010-1234-5678
function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

// 01012345678 -> 010-****-5678
function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 7) return d;
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

// "101-211" / "101 211" / "101동211호" -> "101동 211호"
function normalizeDongHo(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d+)\s*(?:동|-|\s)\s*(\d+)\s*호?$/);
  return m ? `${m[1]}동 ${m[2]}호` : s;
}

function shortDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "numeric", day: "numeric" });
}

function GuestSummary({ g }: { g: GuestRow }) {
  return (
    <span className="text-sm text-muted-foreground">
      대출 {g.rental_count}회
      {g.active_count > 0 && <> · 대여중 {g.active_count}권</>}
      {" · "}최근 {shortDate(g.last_rented_at)}
    </span>
  );
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, startLoading] = useTransition();
  const [search, setSearch] = useState("");
  const [dupOnly, setDupOnly] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [merge, setMerge] = useState<{ a: string; b: string | null } | null>(null);

  const reload = () =>
    startLoading(async () => {
      setGuests(await getGuestList());
      setLoaded(true);
    });

  useEffect(reload, []);

  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const detail = detailId ? byId.get(detailId) ?? null : null;

  // 중복 의심 묶음 (같은 동호수 + 같은 이름)
  const dupGroups = useMemo(() => {
    const m = new Map<string, GuestRow[]>();
    for (const g of guests) if (g.dup_key) m.set(g.dup_key, [...(m.get(g.dup_key) ?? []), g]);
    return [...m.values()];
  }, [guests]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const digits = q.replace(/\D/g, "");
    return guests.filter((g) => {
      if (dupOnly && !g.dup_key) return false;
      if (!q) return true;
      return (
        g.name.includes(q) ||
        g.dong_ho.includes(q) ||
        (digits.length > 0 && g.dong_ho.replace(/\D+/g, "").includes(digits)) ||
        (digits.length >= 4 && g.phone_number.includes(digits))
      );
    });
  }, [guests, search, dupOnly]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <UserRound className="size-5" />
            비회원 목록
            <Badge variant="secondary">{guests.length}명</Badge>
            <Link href="/admin/guest-checkout" className={cn(buttonVariants({ size: "sm" }), "ml-auto")}>
              <UserPlus className="size-4 mr-1" />
              비회원 대출
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dupGroups.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
              <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <Copy className="size-4" />
                같은 사람으로 보이는 비회원이 {dupGroups.length}묶음 있어요
              </p>
              <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                동호수와 이름이 같아요. 연락처를 바꾸면서 새로 생긴 경우가 많아요. 합치면 대출 기록이 한 사람으로 모여요.
              </p>
              <ul className="mt-3 space-y-2">
                {dupGroups.map((group) => (
                  <li key={group[0].dup_key} className="flex flex-wrap items-center gap-2 rounded-md bg-background/80 p-2">
                    <span className="font-medium">{group[0].name}</span>
                    <span className="text-sm text-muted-foreground">{group[0].dong_ho}</span>
                    <span className="text-sm text-muted-foreground">
                      {group.map((g) => `${maskPhone(g.phone_number)}(${g.rental_count}회)`).join(" / ")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => setMerge({ a: group[0].id, b: group[1].id })}
                    >
                      <Merge className="size-4 mr-1" />
                      합치기
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="이름, 동호수, 전화번호 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 text-base"
              />
            </div>
            {dupGroups.length > 0 && (
              <Button variant={dupOnly ? "default" : "outline"} className="h-11" onClick={() => setDupOnly((v) => !v)}>
                중복 의심만
              </Button>
            )}
          </div>

          {!loaded && isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search || dupOnly ? "검색 결과가 없습니다." : "등록된 비회원이 없습니다."}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {filtered.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                    onClick={() => setDetailId(g.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-base font-medium">
                        {g.name}
                        <span className="font-normal text-muted-foreground">{g.dong_ho}</span>
                        {g.overdue_count > 0 && <Badge variant="destructive">연체 {g.overdue_count}</Badge>}
                        {g.dup_key && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                            중복 의심
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2">
                        <span className="font-mono text-sm text-muted-foreground">{maskPhone(g.phone_number)}</span>
                        <GuestSummary g={g} />
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <GuestDetailDialog
        guest={detail}
        onClose={() => setDetailId(null)}
        onChanged={reload}
        onMerge={(id) => {
          const g = byId.get(id);
          const twin = g?.dup_key ? guests.find((x) => x.dup_key === g.dup_key && x.id !== id) : undefined;
          setDetailId(null);
          setMerge({ a: id, b: twin?.id ?? null });
        }}
      />

      <MergeDialog
        state={merge}
        guests={guests}
        onClose={() => setMerge(null)}
        onDone={() => {
          setMerge(null);
          reload();
        }}
      />
    </div>
  );
}

// ─── 상세: 정보 수정 + 대출 기록 + 합치기/삭제 ───

function GuestDetailDialog({
  guest,
  onClose,
  onChanged,
  onMerge,
}: {
  guest: GuestRow | null;
  onClose: () => void;
  onChanged: () => void;
  onMerge: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [dongHo, setDongHo] = useState("");
  const [phone, setPhone] = useState("");
  const [rentals, setRentals] = useState<GuestRental[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const guestId = guest?.id ?? null;
  useEffect(() => {
    if (!guest) return;
    setName(guest.name);
    setDongHo(guest.dong_ho);
    setPhone(formatPhone(guest.phone_number));
    setError(null);
    setSaved(false);
    setConfirmDelete(false);
    setRentals(null);
    getGuestRentals(guest.id).then(setRentals);
    // 다른 사람을 열었을 때만 초기화 (저장 후 목록 갱신으로 guest 객체가 바뀌어도 입력 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  if (!guest) return <Dialog open={false} />;

  const digits = phone.replace(/\D/g, "");
  const changed =
    name.trim() !== guest.name || normalizeDongHo(dongHo) !== guest.dong_ho || digits !== guest.phone_number;

  const handleSave = () =>
    startTransition(async () => {
      setError(null);
      const nextDongHo = normalizeDongHo(dongHo);
      const res = await updateGuest({ id: guest.id, name, dong_ho: nextDongHo, phone: digits });
      if (!res.success) {
        setError(res.error ?? "수정에 실패했습니다.");
        return;
      }
      setDongHo(nextDongHo);
      setSaved(true);
      onChanged();
    });

  const handleDelete = () =>
    startTransition(async () => {
      setError(null);
      const res = await deleteGuest(guest.id);
      if (!res.success) {
        setError(res.error ?? "삭제에 실패했습니다.");
        setConfirmDelete(false);
        return;
      }
      onClose();
      onChanged();
    });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{guest.name}</DialogTitle>
          <DialogDescription>
            <GuestSummary g={guest} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">이름</span>
            <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className="h-11 text-base" maxLength={20} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">동/호수</span>
            <Input
              value={dongHo}
              onChange={(e) => { setDongHo(e.target.value); setSaved(false); }}
              onBlur={() => setDongHo(normalizeDongHo(dongHo))}
              placeholder="101-211"
              className="h-11 text-base"
              maxLength={20}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">전화번호</span>
            <Input
              value={phone}
              onChange={(e) => { setPhone(formatPhone(e.target.value)); setSaved(false); }}
              inputMode="numeric"
              placeholder="010-0000-0000"
              className="h-11 text-base font-mono"
            />
          </label>

          {error && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <Button className="h-11 w-full text-base" onClick={handleSave} disabled={!changed || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : saved && !changed ? "저장했어요" : "정보 저장"}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">대출 기록</p>
          {rentals === null ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground">대출 기록이 없어요.</p>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
              {rentals.map((r) => {
                const overdue = !r.returned_at && r.due_date < today;
                return (
                  <li key={r.id} className="flex items-center gap-2 p-2">
                    <span className="min-w-0 flex-1 truncate">{r.book.title}</span>
                    <span className="shrink-0 text-muted-foreground">{shortDate(r.rented_at)}</span>
                    {r.returned_at ? (
                      <Badge variant="secondary" className="shrink-0">반납</Badge>
                    ) : overdue ? (
                      <Badge variant="destructive" className="shrink-0">연체</Badge>
                    ) : (
                      <Badge className="shrink-0">대여중</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {confirmDelete ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <span className="text-sm">정말 삭제할까요?</span>
              <Button variant="destructive" size="sm" className="ml-auto" onClick={handleDelete} disabled={isPending}>
                삭제
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={isPending}>
                취소
              </Button>
            </div>
          ) : (
            <>
              {guest.rental_count === 0 ? (
                <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4 mr-1" />
                  삭제
                </Button>
              ) : (
                <span className="self-center text-xs text-muted-foreground">대출 기록이 있으면 삭제 대신 합치기로 정리해요</span>
              )}
              <Button variant="outline" onClick={() => onMerge(guest.id)}>
                <Merge className="size-4 mr-1" />
                다른 사람과 합치기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 합치기: 두 사람 중 남길 정보를 고르고, 나머지 한 사람의 기록을 옮긴 뒤 지움 ───

function PersonCard({ g, selected, onSelect }: { g: GuestRow; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      }`}
    >
      <p className="flex items-center gap-2 font-medium">
        {g.name}
        {selected && <Badge>남길 정보</Badge>}
      </p>
      <p className="text-sm text-muted-foreground">{g.dong_ho}</p>
      <p className="font-mono text-sm">{formatPhone(g.phone_number)}</p>
      <GuestSummary g={g} />
    </button>
  );
}

function MergeDialog({
  state,
  guests,
  onClose,
  onDone,
}: {
  state: { a: string; b: string | null } | null;
  guests: GuestRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [otherId, setOtherId] = useState<string | null>(null);
  const [keepId, setKeepId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const aId = state?.a ?? null;
  useEffect(() => {
    if (!state) return;
    setOtherId(state.b);
    setQuery("");
    setError(null);
    // 기본으로 남길 정보: 최근에 빌린 사람 (요즘 쓰는 연락처일 가능성이 높음)
    const a = guests.find((g) => g.id === state.a);
    const b = state.b ? guests.find((g) => g.id === state.b) : undefined;
    setKeepId(b && (b.last_rented_at ?? "") > (a?.last_rented_at ?? "") ? b.id : state.a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, state?.b]);

  if (!state) return <Dialog open={false} />;

  const a = guests.find((g) => g.id === state.a);
  const other = otherId ? guests.find((g) => g.id === otherId) : undefined;
  if (!a) return <Dialog open={false} />;

  const q = query.trim();
  const qDigits = q.replace(/\D/g, "");
  const choices = guests
    .filter((g) => g.id !== a.id)
    .filter((g) =>
      q
        ? g.name.includes(q) || g.dong_ho.includes(q) || (qDigits.length > 0 && g.dong_ho.replace(/\D+/g, "").includes(qDigits)) || (qDigits.length >= 4 && g.phone_number.includes(qDigits))
        : g.dup_key === a.dup_key && !!a.dup_key,
    )
    .slice(0, 8);

  const keep = keepId === other?.id ? other : a;
  const remove = keep === a ? other : a;

  const handleMerge = () => {
    if (!keep || !remove) return;
    startTransition(async () => {
      setError(null);
      const res = await mergeGuests(keep.id, remove.id);
      if (!res.success) {
        setError(res.error ?? "합치기에 실패했습니다.");
        return;
      }
      onDone();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">같은 사람 합치기</DialogTitle>
          <DialogDescription>남길 정보(이름·동호수·연락처)를 고르세요. 대출 기록은 모두 그 사람에게 모여요.</DialogDescription>
        </DialogHeader>

        {!other ? (
          <div className="space-y-3">
            <PersonCard g={a} selected={false} onSelect={() => {}} />
            <p className="text-sm font-medium">누구와 합칠까요?</p>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 동호수, 전화번호로 찾기"
              className="h-11 text-base"
              autoFocus
            />
            {choices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{q ? "찾는 사람이 없어요." : "검색해서 합칠 사람을 고르세요."}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {choices.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50"
                      onClick={() => {
                        setOtherId(g.id);
                        setKeepId((g.last_rented_at ?? "") > (a.last_rented_at ?? "") ? g.id : a.id);
                      }}
                    >
                      <span className="font-medium">{g.name}</span>
                      <span className="text-sm text-muted-foreground">{g.dong_ho}</span>
                      <span className="ml-auto font-mono text-sm text-muted-foreground">{maskPhone(g.phone_number)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <PersonCard g={a} selected={keep?.id === a.id} onSelect={() => setKeepId(a.id)} />
              <PersonCard g={other} selected={keep?.id === other.id} onSelect={() => setKeepId(other.id)} />
            </div>
            {keep && remove && (
              <p className="flex flex-wrap items-center gap-1 rounded-md bg-muted p-3 text-sm">
                {formatPhone(remove.phone_number)}의 대출 기록 {remove.rental_count}건
                <ArrowRight className="size-4" />
                {formatPhone(keep.phone_number)}(으)로 옮기고, {formatPhone(remove.phone_number)}는 지워요.
              </p>
            )}
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setOtherId(null)} disabled={isPending}>
              다른 사람 고르기
            </button>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button onClick={handleMerge} disabled={!other || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <><Merge className="size-4 mr-1" />합치기</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
