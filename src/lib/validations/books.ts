import { z } from 'zod'
import { AR_INTERESTS, AR_FIELD_KEYS, type ArFieldKey } from '@/lib/ar'

// ── AR(Accelerated Reader) 정보 ──
// 설정 ar_enabled='on'일 때만 화면에서 보낸다. 보내지 않으면 스키마 결과에도 키가 없어 기존과 같은 쿼리가 된다.

const arFields = {
  ar_level: z.number({ error: 'AR 레벨은 숫자로 입력하세요.' })
    .min(0, 'AR 레벨은 0~13.9 사이로 입력하세요.')
    .max(13.9, 'AR 레벨은 0~13.9 사이로 입력하세요.')
    .nullable().optional(),
  ar_points: z.number({ error: 'AR 포인트는 숫자로 입력하세요.' })
    .min(0, 'AR 포인트는 0 이상이어야 합니다.')
    .max(9999.9, 'AR 포인트가 너무 큽니다.')
    .nullable().optional(),
  ar_quiz_no: z.number({ error: 'AR 퀴즈 번호는 숫자로 입력하세요.' })
    .int('AR 퀴즈 번호는 정수로 입력하세요.')
    .min(1, 'AR 퀴즈 번호를 확인하세요.')
    .max(2147483647, 'AR 퀴즈 번호를 확인하세요.')
    .nullable().optional(),
  ar_interest: z.enum(AR_INTERESTS, { error: 'Interest는 LG, MG, MG+, UG 중 하나입니다.' }).nullable().optional(),
  word_count: z.number({ error: '단어 수는 숫자로 입력하세요.' })
    .int('단어 수는 정수로 입력하세요.')
    .min(0, '단어 수는 0 이상이어야 합니다.')
    .max(2147483647, '단어 수를 확인하세요.')
    .nullable().optional(),
  lexile: z.string().max(10, 'Lexile은 10자 이내로 입력하세요.').nullable().optional(),
}

/**
 * FormData에서 AR 칸을 읽는다. **폼에 들어 있는 키만** 결과에 넣는다(안 보낸 키는 건드리지 않음).
 * 빈 문자열은 null(지우기). 숫자 칸은 Number로 바꾸고, 잘못된 값(NaN)은 스키마에서 걸러진다.
 */
export function readArFields(formData: FormData): Partial<Record<ArFieldKey, unknown>> {
  const out: Partial<Record<ArFieldKey, unknown>> = {}
  for (const key of AR_FIELD_KEYS) {
    if (!formData.has(key)) continue
    const raw = String(formData.get(key) ?? '').trim()
    if (raw === '') {
      out[key] = null
    } else if (key === 'ar_interest' || key === 'lexile') {
      out[key] = raw.toUpperCase()
    } else {
      const n = Number(raw.replace(/,/g, ''))
      // 레벨·포인트는 DB가 소수 첫째 자리까지라 미리 맞춘다 (3.55 → 3.6). 입력값과 저장값이 달라 보이지 않게
      out[key] = (key === 'ar_level' || key === 'ar_points') && Number.isFinite(n) ? Math.round(n * 10) / 10 : n
    }
  }
  return out
}

export const createBookSchema = z.object({
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
  title: z.string().min(1, '도서명을 입력해주세요.').max(200),
  author: z.string().max(100).optional().default(''),
  publisher: z.string().max(100).optional(),
  cover_image: z.string().optional(),
  description: z.string().optional(),
  location_group: z.string().optional().default(''),
  location_detail: z.string().optional().default(''),
  isbn: z.string().max(30).optional().default(''),
  translators: z.string().max(200).optional().default(''),
  published_at: z.string().max(20).optional().default(''),
  price: z.coerce.number().int().optional().default(0),
  sale_price: z.coerce.number().int().optional().default(0),
  category: z.string().max(200).optional().default(''),
  kakao_url: z.string().optional().default(''),
  sale_status: z.string().max(20).optional().default(''),
  rental_days: z.coerce.number().int().min(1).max(90).nullable().optional(),
  ...arFields,
})

// partial()은 default()도 가져오므로, 업데이트 시 불필요한 기본값으로 덮어쓰기 방지
export const updateBookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().max(100),
  publisher: z.string().max(100),
  cover_image: z.string(),
  description: z.string(),
  location_group: z.string(),
  location_detail: z.string(),
  isbn: z.string().max(30),
  translators: z.string().max(200),
  published_at: z.string().max(20),
  price: z.coerce.number().int(),
  sale_price: z.coerce.number().int(),
  category: z.string().max(200),
  kakao_url: z.string(),
  sale_status: z.string().max(20),
  rental_days: z.coerce.number().int().min(1).max(90).nullable(),
  ...arFields,
}).partial()

export const checkoutSchema = z.object({
  user_id: z.string().uuid('유효하지 않은 주민 ID입니다.'),
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
})

export const returnSchema = z.object({
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
})
