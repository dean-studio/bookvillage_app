"use client";

// 학원 모드 전용 화면 감싸개. 학원이 아니면 안내 문구만 보여 주고 안쪽 화면(과 그 서버 호출)은 그리지 않는다.
// 서버 액션(actions/academy.ts)도 따로 학원 모드를 확인하므로 이 감싸개는 화면 안내용이다.

import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicSettings } from "@/app/actions/settings";
import { isAcademy } from "@/lib/site-mode";

export function AcademyGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "academy" | "other">("loading");

  useEffect(() => {
    let alive = true;
    getPublicSettings()
      .then((s) => {
        if (alive) setState(isAcademy(s.site_type) ? "academy" : "other");
      })
      .catch(() => {
        if (alive) setState("other");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "other") {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex items-center gap-2 pt-6 text-muted-foreground">
          <Info className="size-5 shrink-0" />
          학원 모드에서만 쓸 수 있는 화면입니다.
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
