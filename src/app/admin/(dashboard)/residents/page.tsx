"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Search, UserPlus, QrCode } from "lucide-react";
import { getAllResidents } from "@/app/actions/rentals";
import { isMemberCardCode } from "@/lib/member-card";

type Resident = Awaited<ReturnType<typeof getAllResidents>>[number];

function maskPhone(phone: string): string {
  if (phone.length === 11) {
    return phone.slice(0, 3) + "****" + phone.slice(7);
  }
  if (phone.length >= 7) {
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }
  return "***";
}

// 카드 회원은 phone_number가 카드 코드 → 보호자 연락처(선택)를 표시
function contactOf(r: Resident): string {
  if (isMemberCardCode(r.phone_number)) return r.contact_phone ? maskPhone(r.contact_phone) : "-";
  return maskPhone(r.phone_number);
}

export default function AdminResidentsPage() {
  const router = useRouter();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  useEffect(() => {
    startTransition(async () => {
      const data = await getAllResidents();
      setResidents(data);
    });
  }, []);

  const filtered = search.trim()
    ? residents.filter(
        (r) =>
          r.name.includes(search) ||
          r.dong_ho.includes(search) ||
          r.phone_number.includes(search) ||
          (r.contact_phone ?? "").includes(search)
      )
    : residents;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            회원 목록
            <Badge variant="secondary" className="ml-1">{residents.length}명</Badge>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push("/admin/residents/cards")}>
                <QrCode className="size-4 mr-1" />
                카드 인쇄
              </Button>
              <Button size="sm" onClick={() => router.push("/admin/residents/new")}>
                <UserPlus className="size-4 mr-1" />
                회원 추가
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="이름, 소속, 연락처 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? "검색 결과가 없습니다." : "등록된 회원이 없습니다."}
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>소속</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead className="text-right">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/admin/residents/${r.id}`)}
                      >
                        <TableCell className="font-medium">
                          {r.name}
                          {isMemberCardCode(r.phone_number) && (
                            <Badge variant="outline" className="ml-2 align-middle">QR</Badge>
                          )}
                        </TableCell>
                        <TableCell>{r.dong_ho}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {contactOf(r)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filtered.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/residents/${r.id}`)}
                  >
                    <div>
                      <p className="font-medium">
                        {r.name}
                        {isMemberCardCode(r.phone_number) && (
                          <Badge variant="outline" className="ml-2 align-middle">QR</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {r.dong_ho} · {contactOf(r)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(r.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
