import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 두벌식 한글 자모 → 대응 영문 키 매핑
// (바코드 리더기가 한글 IME 상태에서 입력하면 BV → ㅠㅍ 처럼 자모로 찍히는 문제 복원용)
const HANGUL_TO_QWERTY: Record<string, string> = {
  ㅂ: "q", ㅈ: "w", ㄷ: "e", ㄱ: "r", ㅅ: "t", ㅛ: "y", ㅕ: "u", ㅑ: "i", ㅐ: "o", ㅔ: "p",
  ㅁ: "a", ㄴ: "s", ㅇ: "d", ㄹ: "f", ㅎ: "g", ㅗ: "h", ㅓ: "j", ㅏ: "k", ㅣ: "l",
  ㅋ: "z", ㅌ: "x", ㅊ: "c", ㅍ: "v", ㅠ: "b", ㅜ: "n", ㅡ: "m",
  ㅃ: "Q", ㅉ: "W", ㄸ: "E", ㄲ: "R", ㅆ: "T", ㅒ: "O", ㅖ: "P",
}

// 완성형 한글(가~힣)이나 자모가 섞여 들어온 바코드 입력을 영문/숫자로 복원
export function hangulToLatinKeys(input: string): string {
  let out = ""
  for (const ch of input) {
    // 완성형 한글은 자모로 분해
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00
      const cho = Math.floor(idx / 588)
      const jung = Math.floor((idx % 588) / 28)
      const jong = idx % 28
      const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
      const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
      const JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
      for (const jamo of [CHO[cho], JUNG[jung], JONG[jong]]) {
        if (jamo && jamo !== " ") out += HANGUL_TO_QWERTY[jamo] ?? jamo
      }
    } else if (HANGUL_TO_QWERTY[ch]) {
      out += HANGUL_TO_QWERTY[ch]
    } else {
      out += ch
    }
  }
  return out
}
