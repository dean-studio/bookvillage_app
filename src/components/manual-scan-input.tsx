"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// 리더기 없이 카드 코드/책 바코드를 직접 입력해 스캔과 동일하게 처리 (리더기 고장·테스트용)
export function ManualScanInput({ onSubmit, placeholder }: { onSubmit: (value: string) => void; placeholder: string }) {
  const [value, setValue] = useState("");

  function submit() {
    const v = value.trim();
    if (!v) return;
    setValue("");
    onSubmit(v);
  }

  return (
    <div className="w-full max-w-md flex gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 p-2 dark:bg-amber-950/30">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
        placeholder={placeholder}
        className="h-12 text-lg font-mono bg-background"
      />
      <Button className="h-12" onClick={submit} disabled={!value.trim()}>
        입력
      </Button>
    </div>
  );
}
