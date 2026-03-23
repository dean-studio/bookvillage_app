'use server'

import { createClient } from '@/lib/supabase/server'
import { signUpSchema, signInSchema, adminSignInSchema, phoneToEmail, adminToEmail, pinToPassword } from '@/lib/validations/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/types'
import { z } from 'zod'

const adminSignUpSchema = z.object({
  username: z.string().min(1, '아이디를 입력해주세요.').max(50),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다.'),
  name: z.string().min(1, '이름을 입력해주세요.').max(20),
})

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

  // 1. Auth 유저 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: phoneToEmail(phone_number),
    password: pinToPassword(pin),
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return { success: false, error: '이미 가입된 휴대폰 번호입니다.' }
    }
    return { success: false, error: `회원가입에 실패했습니다: ${authError.message}` }
  }

  // 2. 프로필 생성
  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        phone_number,
        name,
        dong_ho,
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return { success: false, error: `프로필 생성 실패: ${profileError.message}` }
    }
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
    password: pinToPassword(pin),
  })

  if (error) {
    return { success: false, error: '휴대폰 번호 또는 비밀번호가 올바르지 않습니다.' }
  }

  return { success: true }
}

export async function checkPhoneExists(phoneNumber: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone_number', phoneNumber)
    .limit(1)
    .maybeSingle()

  return !!data
}

export async function adminSignIn(formData: FormData): Promise<ActionResult> {
  const raw = {
    username: formData.get('username'),
    password: formData.get('password'),
  }

  const parsed = adminSignInSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { username, password } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: adminToEmail(username),
    password,
  })

  if (error) {
    return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  // 관리자 role + 승인 상태 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, admin_status')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      return { success: false, error: '관리자 권한이 없습니다.' }
    }

    if (profile.admin_status === 'pending') {
      await supabase.auth.signOut()
      return { success: false, error: '관리자 승인 대기 중입니다. 기존 관리자의 승인이 필요합니다.' }
    }

    if (profile.admin_status !== 'approved') {
      await supabase.auth.signOut()
      return { success: false, error: '관리자 계정이 승인되지 않았습니다.' }
    }
  }

  return { success: true }
}

export async function adminSignUp(formData: FormData): Promise<ActionResult> {
  const raw = {
    username: formData.get('username'),
    password: formData.get('password'),
    name: formData.get('name'),
  }

  const parsed = adminSignUpSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { username, password, name } = parsed.data

  // 1. Auth 유저 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: adminToEmail(username),
    password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return { success: false, error: '이미 사용 중인 아이디입니다.' }
    }
    return { success: false, error: `계정 생성에 실패했습니다: ${authError.message}` }
  }

  // 2. 프로필 직접 생성 (admin + pending)
  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        phone_number: `admin_${username}`,
        name,
        dong_ho: '관리자',
        role: 'admin',
        admin_status: 'pending',
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return { success: false, error: `프로필 생성 실패: ${profileError.message}` }
    }
  }

  return { success: true }
}

export async function getPendingAdmins() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || user.admin_status !== 'approved') {
    return []
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, name, created_at')
    .eq('role', 'admin')
    .eq('admin_status', 'pending')
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function approveAdmin(adminId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || user.admin_status !== 'approved') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ admin_status: 'approved' })
    .eq('id', adminId)
    .eq('role', 'admin')
    .eq('admin_status', 'pending')

  if (error) {
    return { success: false, error: '승인 처리에 실패했습니다.' }
  }

  return { success: true }
}

export async function rejectAdmin(adminId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || user.admin_status !== 'approved') {
    return { success: false, error: '권한이 없습니다.' }
  }

  // Auth 계정 삭제 (Service Role)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(adminId)
  if (authError) {
    return { success: false, error: '계정 삭제에 실패했습니다.' }
  }

  return { success: true }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function adminSignOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
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
