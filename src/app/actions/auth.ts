'use server'

import { createClient } from '@/lib/supabase/server'
import { signUpSchema, signInSchema, phoneToEmail } from '@/lib/validations/auth'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/types'

export async function signUp(formData: FormData): Promise<ActionResult> {
  const raw = {
    phone_number: formData.get('phone_number'),
    pin: formData.get('pin'),
    name: formData.get('name'),
    dong_ho: formData.get('dong_ho'),
  }

  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { phone_number, pin, name, dong_ho } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: phoneToEmail(phone_number),
    password: pin,
    options: {
      data: {
        phone_number,
        name,
        dong_ho,
      },
    },
  })

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return { success: false, error: '이미 가입된 휴대폰 번호입니다.' }
    }
    return { success: false, error: '회원가입에 실패했습니다. 다시 시도해주세요.' }
  }

  return { success: true }
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const raw = {
    phone_number: formData.get('phone_number'),
    pin: formData.get('pin'),
  }

  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { phone_number, pin } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone_number),
    password: pin,
  })

  if (error) {
    return { success: false, error: '휴대폰 번호 또는 비밀번호가 올바르지 않습니다.' }
  }

  return { success: true }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
