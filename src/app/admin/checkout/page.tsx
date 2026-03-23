"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ScanBarcode,
  UserSearch,
  CheckCircle2,
  User,
  BookOpen,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { searchResidents, checkoutBook } from "@/app/actions/rentals";

interface Resident {
  id: string;
  name: string;
  dong_ho: string;
  phone_number: string;
}

interface CheckoutResult {
  book: { title: string; barcode: string };
  user: { name: string; dong_ho: string };
  due_date: string;
}

export default function AdminCheckoutPage() {
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [selectedMember, setSelectedMember] = useState<Resident | null>(null);
  const [bookBarcode, setBookBarcode] = useState("");
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState("");
  const [isSearching, startSearching] = useTransition();
  const [isCheckingOut, startCheckout] = useTransition();

  const handleMemberSearch = () => {
    if (!memberSearch.trim()) return;
    setError("");
    startSearching(async () => {
      const result = await searchResidents(memberSearch.trim());
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSearchResults(result.data);
    });
  };

  const handleCheckout = () => {
    if (!selectedMember || !bookBarcode.trim()) return;
    setError("");
    startCheckout(async () => {
      const formData = new FormData();
      formData.set("user_id", selectedMember.id);
      formData.set("barcode", bookBarcode.trim());

      const result = await checkoutBook(formData);
      if (!result.success) {
        setError(result.error || "대출 처리에 실패했습니다.");
        return;
      }
      if (result.data) {
        setCheckoutResult({
          book: result.data.book,
          user: result.data.user,
          due_date: result.data.due_date,
        });
      }
    });
  };

  const handleReset = () => {
    setMemberSearch("");
    setSearchResults([]);
    setSelectedMember(null);
    setBookBarcode("");
    setCheckoutResult(null);
    setError("");
  };

  if (checkoutResult) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">대출 처리</h1>
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle2 className="size-12 mx-auto text-green-600" />
            <p className="font-semibold text-lg">대출이 완료되었습니다!</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  {checkoutResult.user.name}
                </span>{" "}
                ({checkoutResult.user.dong_ho})
              </p>
              <p>
                &laquo;{checkoutResult.book.title}&raquo;
              </p>
              <p className="mt-2">
                반납 기한:{" "}
                <Badge variant="outline">
                  {new Date(checkoutResult.due_date).toLocaleDateString("ko-KR")}
                </Badge>
              </p>
            </div>
            <Button variant="outline" onClick={handleReset}>
              다음 대출 처리
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">대출 처리</h1>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: 주민 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge
              variant={selectedMember ? "default" : "outline"}
              className="rounded-full size-6 p-0 flex items-center justify-center"
            >
              1
            </Badge>
            주민 선택
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedMember ? (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{selectedMember.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedMember.dong_ho} · {selectedMember.phone_number}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMember(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="이름 또는 동호수로 검색"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleMemberSearch()
                    }
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleMemberSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "검색"
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>동/호수</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.dong_ho}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMember(m);
                              setSearchResults([]);
                            }}
                          >
                            선택
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 2: 도서 스캔 */}
      <Card className={!selectedMember ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge
              variant={bookBarcode ? "default" : "outline"}
              className="rounded-full size-6 p-0 flex items-center justify-center"
            >
              2
            </Badge>
            도서 스캔
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="도서 바코드 스캔"
              value={bookBarcode}
              onChange={(e) => setBookBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
              disabled={!selectedMember}
            />
            <Button variant="outline" disabled={!selectedMember}>
              <ScanBarcode className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 대출 처리 버튼 */}
      <Button
        className="w-full h-12 text-base"
        disabled={!selectedMember || !bookBarcode.trim() || isCheckingOut}
        onClick={handleCheckout}
      >
        {isCheckingOut ? (
          <Loader2 className="size-5 mr-2 animate-spin" />
        ) : (
          <CheckCircle2 className="size-5 mr-2" />
        )}
        대출 처리
      </Button>
    </div>
  );
}
