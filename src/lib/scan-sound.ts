"use client";

// 바코드 연속 스캔 피드백음 (화면을 안 봐도 결과를 알 수 있게). 파일 없이 Web Audio로 짧은 음을 만든다.
export type ScanSound = "ok" | "info" | "error";

let ctx: AudioContext | null = null;

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine") {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

export function playScanSound(kind: ScanSound) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "ok") tone(ctx, 1320, 0, 0.12); // 삑
    else if (kind === "info") { tone(ctx, 880, 0, 0.08); tone(ctx, 880, 0.12, 0.08); } // 삑삑 (이미 그 책장)
    else tone(ctx, 220, 0, 0.35, "square"); // 뿌 (실패)
  } catch {
    /* 소리를 못 내도 이동은 그대로 */
  }
}
