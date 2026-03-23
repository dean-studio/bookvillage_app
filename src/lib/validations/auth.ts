import { z } from 'zod'

export const signUpSchema = z.object({
  phone_number: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, '유효하지 않은 휴대폰 번호 형식입니다.'),
  pin: z
    .string()
    .regex(/^\d{4}$/, '비밀번호는 4자리 숫자여야 합니다.'),
  name: z
    .string()
    .min(1, '이름을 입력해주세요.')
    .max(20, '이름은 20자 이내여야 합니다.'),
  dong_ho: z
    .string()
    .min(1, '동호수를 입력해주세요.')
    .max(20, '동호수는 20자 이내여야 합니다.'),
})

export const signInSchema = z.object({
  phone_number: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, '유효하지 않은 휴대폰 번호 형식입니다.'),
  pin: z
    .string()
    .regex(/^\d{4}$/, '비밀번호는 4자리 숫자여야 합니다.'),
})

export function phoneToEmail(phone: string): string {
  return `${phone}@bookvillage.local`
}
