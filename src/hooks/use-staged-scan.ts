"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playScanSound } from "@/lib/scan-sound";

// 바코드를 찍으면 바로 처리하지 않고 '대기 목록'에 쌓는다 (책장 이동·폐기 공통).
// 리더기로 빠르게 연달아 찍어도 순서대로 하나씩 확인하고, 같은 책은 한 번만 담는다.

export type StagedItem<T> =
  | { key: number; barcode: string; state: "loading" }
  | { key: number; barcode: string; state: "ready"; id: string; data: T }
  | { key: number; barcode: string; state: "error"; error: string };

export type ScanNotice = { tone: "ok" | "info" | "error"; title?: string; message: string };

export type PreviewResult<T> = { ok: true; id: string; data: T; title: string; info?: string } | { ok: false; error: string };

let keySeq = 0;

export function useStagedScan<T>(
  preview: (code: string) => Promise<PreviewResult<T>>,
  { sound, addedMessage }: { sound: boolean; addedMessage: (data: T) => string }
) {
  const [items, setItems] = useState<StagedItem<T>[]>([]);
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const itemsRef = useRef(items);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const previewRef = useRef(preview);
  const optsRef = useRef({ sound, addedMessage });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    previewRef.current = preview;
    optsRef.current = { sound, addedMessage };
  }, [preview, sound, addedMessage]);

  const say = (n: ScanNotice) => {
    setNotice(n);
    if (optsRef.current.sound) playScanSound(n.tone);
    return n;
  };

  const process = async (key: number, code: string): Promise<ScanNotice> => {
    const res = await previewRef.current(code);
    if (!res.ok) {
      setItems((prev) => prev.map((it) => (it.key === key ? { key, barcode: code, state: "error", error: res.error } : it)));
      return say({ tone: "error", message: res.error });
    }
    const dup = itemsRef.current.some((it) => it.state === "ready" && it.id === res.id && it.key !== key);
    if (dup) {
      setItems((prev) => prev.filter((it) => it.key !== key));
      return say({ tone: "info", title: res.title, message: "이미 목록에 있어요" });
    }
    const ready = { key, barcode: code, state: "ready" as const, id: res.id, data: res.data };
    itemsRef.current = itemsRef.current.map((it) => (it.key === key ? ready : it));
    setItems((prev) => prev.map((it) => (it.key === key ? ready : it)));
    return say(
      res.info
        ? { tone: "info", title: res.title, message: res.info }
        : { tone: "ok", title: res.title, message: optsRef.current.addedMessage(res.data) }
    );
  };

  // 찍은 바코드를 목록에 담기. 결과 알림을 돌려줌 (카메라 화면 표시용)
  const enqueue = useCallback((raw: string): Promise<ScanNotice> => {
    const code = raw.trim();
    if (!code) return Promise.resolve({ tone: "error", message: "바코드를 입력해주세요." });
    const key = ++keySeq;
    const loading = { key, barcode: code, state: "loading" as const };
    itemsRef.current = [loading, ...itemsRef.current];
    setItems((prev) => [loading, ...prev]);
    setPendingCount((n) => n + 1);
    const job = chainRef.current.then(() => process(key, code)).finally(() => setPendingCount((n) => n - 1));
    chainRef.current = job.catch(() => {});
    return job;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (key: number) => setItems((prev) => prev.filter((it) => it.key !== key));
  const removeIds = (ids: Set<string>) =>
    setItems((prev) => prev.filter((it) => !(it.state === "ready" && ids.has(it.id))));
  const clearErrors = () => setItems((prev) => prev.filter((it) => it.state !== "error"));
  const clear = () => {
    setItems((prev) => prev.filter((it) => it.state === "loading"));
    setNotice(null);
  };

  return { items, notice, setNotice: say, busy: pendingCount > 0, enqueue, remove, removeIds, clearErrors, clear };
}
