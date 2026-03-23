import { z } from 'zod'

export const createBookSchema = z.object({
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
  title: z.string().min(1, '도서명을 입력해주세요.').max(200),
  author: z.string().min(1, '저자를 입력해주세요.').max(100),
  publisher: z.string().max(100).optional(),
  cover_image: z.string().optional(),
  description: z.string().optional(),
  location_group: z.string().min(1, '서가 그룹을 선택해주세요.'),
  location_detail: z.string().min(1, '서가 상세 위치를 입력해주세요.'),
})

export const updateBookSchema = createBookSchema.partial().omit({ barcode: true })

export const checkoutSchema = z.object({
  user_id: z.string().uuid('유효하지 않은 주민 ID입니다.'),
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
})

export const returnSchema = z.object({
  barcode: z.string().min(1, '바코드를 입력해주세요.'),
})
