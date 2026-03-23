/**
 * 한국 시간(KST, UTC+9) 기준 날짜 유틸리티
 * Vercel 서버는 UTC이므로 날짜 계산 시 반드시 KST 변환 필요
 */

/** 현재 한국 시간 Date 객체 반환 */
export function getKSTNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
}

/** 현재 한국 날짜를 YYYY-MM-DD 문자열로 반환 */
export function getKSTDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

/** 현재 한국 시간 ISO 문자열 반환 (timestamptz용) */
export function getKSTISOString(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
}

/** 한국 시간 기준으로 N일 후 날짜를 YYYY-MM-DD로 반환 */
export function getKSTDateAfterDays(days: number): string {
  const kst = getKSTNow()
  kst.setDate(kst.getDate() + days)
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
