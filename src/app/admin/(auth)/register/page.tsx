"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { adminSignUp } from "@/app/actions/auth";

export default function AdminRegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("username", username.trim());
    formData.set("password", password);
    formData.set("name", name.trim());

    startTransition(async () => {
      const result = await adminSignUp(formData);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error ?? "가입에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">관리자 가입 신청</CardTitle>
          <p className="text-sm text-muted-foreground">
            가입 후 기존 관리자의 승인이 필요합니다
          </p>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="py-6 text-center space-y-4">
              <CheckCircle2 className="size-12 mx-auto text-green-600" />
              <div className="space-y-1">
                <p className="font-semibold text-lg">가입 신청이 완료되었습니다</p>
                <p className="text-sm text-muted-foreground">
                  관리자 승인 대기 중입니다.
                  <br />
                  승인 후 로그인할 수 있습니다.
                </p>
              </div>
              <Link href="/admin/login">
                <Button variant="outline" className="w-full">
                  로그인 페이지로 돌아가기
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 px-4 py-3 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">이름</label>
                <Input
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">아이디</label>
                <Input
                  placeholder="사용할 아이디"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">비밀번호</label>
                <Input
                  type="password"
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending || !username.trim() || !password || !name.trim()}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> 가입 신청 중...
                  </span>
                ) : (
                  "가입 신청"
                )}
              </Button>
              <div className="text-center">
                <Link
                  href="/admin/login"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  이미 계정이 있나요? 로그인
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
