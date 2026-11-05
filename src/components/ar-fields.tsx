"use client";

// AR(Accelerated Reader) 입력 칸·배지. 설정 ar_enabled === 'on' 일 때만 화면에 그린다.
// 꺼져 있으면(키 없음 포함) 부르는 쪽에서 렌더하지 않고 FormData 에도 AR 키를 넣지 않는다.

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getPublicSettings } from "@/app/actions/settings";
import { isFlagOn } from "@/lib/site-mode";
import { cn } from "@/lib/utils";
import {
  AR_BOOKFIND_URL,
  AR_INTEREST_LABELS,
  AR_INTERESTS,
  formatArBadge,
  type ArValues,
} from "@/lib/ar";

/** 설정 ar_enabled === 'on' 인지. 불러오기 전·실패 시 false (= AR 화면 없음, 기존과 같음) */
export function useArEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    getPublicSettings()
      .then((s) => {
        if (alive) setOn(isFlagOn(s, "ar_enabled"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return on;
}

/** AR BookFinder 를 새 탭으로 열고, 제목을 클립보드에 복사해 검색창에 바로 붙여 넣을 수 있게 한다 */
export function ArFindLink({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <a
      href={AR_BOOKFIND_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        const t = title.trim();
        if (t && navigator.clipboard) {
          navigator.clipboard
            .writeText(t)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            })
            .catch(() => {});
        }
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      AR 찾기
      <ExternalLink className="size-3" />
      {copied && <span className="text-muted-foreground font-normal">(제목 복사됨)</span>}
    </a>
  );
}

export function ArFieldsEditor({
  value,
  onChange,
  title,
  inputClassName = "h-10",
}: {
  value: ArValues;
  onChange: (next: ArValues) => void;
  /** AR 찾기에서 복사할 도서명 */
  title: string;
  inputClassName?: string;
}) {
  const set = (key: keyof ArValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">AR 정보 (선택)</p>
        <ArFindLink title={title} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">Book Level</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={13.9}
            placeholder="예: 3.5"
            value={value.ar_level}
            onChange={set("ar_level")}
            className={inputClassName}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Points</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            placeholder="예: 2.0"
            value={value.ar_points}
            onChange={set("ar_points")}
            className={inputClassName}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Quiz No</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="예: 12345"
            value={value.ar_quiz_no}
            onChange={set("ar_quiz_no")}
            className={inputClassName}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Interest</label>
          <select
            value={value.ar_interest}
            onChange={set("ar_interest")}
            className={cn("w-full rounded-md border border-input bg-background px-2 text-sm", inputClassName)}
          >
            <option value="">선택 안 함</option>
            {AR_INTERESTS.map((i) => (
              <option key={i} value={i}>
                {AR_INTEREST_LABELS[i] ?? i}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Word count (선택)</label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value.word_count}
            onChange={set("word_count")}
            className={inputClassName}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Lexile (선택)</label>
          <Input
            placeholder="예: 520L"
            maxLength={10}
            value={value.lexile}
            onChange={set("lexile")}
            className={inputClassName}
          />
        </div>
      </div>
    </div>
  );
}

type ArBookLike = Parameters<typeof formatArBadge>[0];

/** 'BL 3.5 · 2.0 pts · Quiz #12345' 배지. 값이 없으면 아무것도 그리지 않는다. (ar_enabled 확인은 부르는 쪽에서) */
export function ArBadge({ book, className = "" }: { book: ArBookLike; className?: string }) {
  const text = formatArBadge(book);
  if (!text) return null;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
        className
      )}
    >
      {text}
    </span>
  );
}
