import { z } from 'zod'

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
}).partial()

export const checkoutSchema = z.object({
  user_id: z.string().uuid('유효하지 않은 주민 ID입니다.'),
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
})

export const returnSchema = z.object({
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
})
