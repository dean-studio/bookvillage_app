"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { adminSignIn } from "@/app/actions/auth";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("username", username);
    formData.set("password", password);

    startTransition(async () => {
      const result = await adminSignIn(formData);
      if (result.success) {
        router.push("/admin");
      } else {
        setError(result.error ?? "로그인에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-8 pt-10 pb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">관리자 로그인</CardTitle>
          <p className="text-base text-muted-foreground mt-1">책빌리지 관리자 전용</p>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-5 py-4 text-center">
                <p className="text-base text-destructive">{error}</p>
              </div>
            )}
            <div>
              <label className="text-base font-medium mb-2 block">아이디</label>
              <Input
                placeholder="관리자 아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isPending}
                autoFocus
                className="h-13 text-lg px-4"
              />
            </div>
            <div>
              <label className="text-base font-medium mb-2 block">비밀번호</label>
              <Input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className="h-13 text-lg px-4"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-13 text-lg mt-2"
              disabled={isPending || !username || !password}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-5 animate-spin" /> 로그인 중...
                </span>
              ) : (
                "로그인"
              )}
            </Button>
          </form>
          <div className="text-center mt-6">
            <Link
              href="/admin/register"
              className="text-base text-muted-foreground hover:underline"
            >
              관리자 가입 신청
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
