import { hangulToLatinKeys } from "@/lib/utils"

// 회원카드(QR) 코드: 'M' + 숫자 10자리 → profiles.phone_number(varchar 11) 자리에 그대로 저장.
// 로그인은 기존 휴대폰 방식 재사용: 이메일 {code}@bookvillage.local, 비밀번호 = 코드 자체.
export const MEMBER_CARD_PREFIX = "M"
const CARD_CODE_RE = /^M\d{10}$/

export function isMemberCardCode(value: string | null | undefined): boolean {
  return !!value && CARD_CODE_RE.test(value)
}

// 리더기 입력 정규화: 한글 IME 상태로 찍힌 값(M → ㅡ) 복원 + 대문자
export function normalizeScanInput(input: string): string {
  return hangulToLatinKeys(input).trim().toUpperCase()
}

// 키오스크/로그인 화면 전역 키 입력용: IME와 무관하게 물리 키(e.code)로 문자 복원
export function keyEventToChar(e: KeyboardEvent): string | null {
  const code = e.code
  if (code.startsWith("Key") && code.length === 4) return code.slice(3)
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5)
  if (code.startsWith("Numpad") && /^\d$/.test(code.slice(6))) return code.slice(6)
  if (e.key && e.key.length === 1) return e.key.toUpperCase()
  return null
}

// library_settings.member_groups(JSON 배열) → 반 이름 목록
export function parseGroups(raw: string | undefined): string[] {
  try {
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr.filter((g): g is string => typeof g === "string") : []
  } catch {
    return []
  }
}
