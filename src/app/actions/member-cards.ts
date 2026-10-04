'use server'

import { randomInt } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { phoneToEmail, pinToPassword } from '@/lib/validations/auth'
import { MEMBER_CARD_PREFIX, isMemberCardCode, normalizeScanInput } from '@/lib/member-card'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

async function requireApprovedAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || user.admin_status !== 'approved') return null
  return user
}

function generateCardCode(): string {
  return MEMBER_CARD_PREFIX + String(randomInt(0, 10_000_000_000)).padStart(10, '0')
}

// 코드 중복 시(확률 극히 낮음) 재시도하며 Auth 유저 생성
async function createAuthUserWithNewCode(): Promise<{ id: string; code: string } | { error: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCardCode()
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: phoneToEmail(code),
      password: pinToPassword(code),
      email_confirm: true,
    })
    if (!error && data.user) return { id: data.user.id, code }
    if (error && !error.message.includes('already')) return { error: error.message }
  }
  return { error: '회원카드 코드 생성에 실패했습니다.' }
}

export type CardMemberInput = { name: string; group: string; contact_phone?: string; memo?: string }

// 입력 정리·검증: 이름/반 필수, 연락처(숫자만)·메모는 선택
function parseMemberInput(input: CardMemberInput) {
  const name = input.name.trim()
  const group = input.group.trim()
  const contact_phone = (input.contact_phone ?? '').replace(/\D/g, '') || null
  const memo = (input.memo ?? '').trim() || null
  if (!name || name.length > 20) return { error: '이름은 1~20자로 입력해주세요.' }
  if (!group || group.length > 20) return { error: '반은 1~20자로 입력해주세요.' }
  if (contact_phone && contact_phone.length > 20) return { error: '휴대폰 번호가 너무 깁니다.' }
  if (memo && memo.length > 500) return { error: '메모는 500자 이내여야 합니다.' }
  return { values: { name, dong_ho: group, contact_phone, memo } }
}

// 관리자: 카드 회원 생성 (QR 코드 자동 발급)
export async function createCardMember(input: CardMemberInput): Promise<ActionResult<{ id: string }>> {
  if (!(await requireApprovedAdmin())) return { success: false, error: '권한이 없습니다.' }

  const parsed = parseMemberInput(input)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const auth = await createAuthUserWithNewCode()
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: auth.id, phone_number: auth.code, ...parsed.values })
  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(auth.id)
    return { success: false, error: `회원 생성 실패: ${error.message}` }
  }

  return { success: true, data: { id: auth.id } }
}

// 관리자: 카드 회원 목록 (카드 인쇄용)
export async function getCardMembers() {
  if (!(await requireApprovedAdmin())) return []

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho, phone_number, created_at')
    .eq('role', 'resident')
    .like('phone_number', `${MEMBER_CARD_PREFIX}%`)
    .order('dong_ho', { ascending: true })
    .order('name', { ascending: true })

  return (data ?? []).filter((p) => isMemberCardCode(p.phone_number))
}

// 관리자: 카드 회원 정보 수정 (이름/반/연락처/메모)
export async function updateCardMemberInfo(userId: string, input: CardMemberInput): Promise<ActionResult> {
  if (!(await requireApprovedAdmin())) return { success: false, error: '권한이 없습니다.' }

  const parsed = parseMemberInput(input)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(parsed.values)
    .eq('id', userId)
    .eq('role', 'resident')
    .like('phone_number', `${MEMBER_CARD_PREFIX}%`)

  if (error) return { success: false, error: '저장에 실패했습니다.' }
  return { success: true }
}

// 관리자: 카드 재발급 — 새 코드로 교체, 기존 카드는 무효
export async function reissueMemberCard(userId: string): Promise<ActionResult<{ code: string }>> {
  if (!(await requireApprovedAdmin())) return { success: false, error: '권한이 없습니다.' }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, phone_number')
    .eq('id', userId)
    .single()

  if (!target || target.role !== 'resident' || !isMemberCardCode(target.phone_number)) {
    return { success: false, error: '카드 회원이 아닙니다.' }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCardCode()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: phoneToEmail(code),
      password: pinToPassword(code),
      email_confirm: true,
    })
    if (error) {
      if (error.message.includes('already')) continue
      return { success: false, error: '재발급에 실패했습니다.' }
    }
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone_number: code })
      .eq('id', userId)
    if (profileError) return { success: false, error: '재발급에 실패했습니다.' }
    return { success: true, data: { code } }
  }
  return { success: false, error: '재발급에 실패했습니다.' }
}

// 회원카드 QR로 로그인 (리더기/카메라 입력)
export async function signInByCard(rawCode: string): Promise<ActionResult<{ name: string }>> {
  const code = normalizeScanInput(rawCode)
  if (!isMemberCardCode(code)) {
    return { success: false, error: '회원카드가 아닙니다.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(code),
    password: pinToPassword(code),
  })
  if (error || !data.user) {
    return { success: false, error: '등록되지 않은 회원카드입니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', data.user.id)
    .single()

  return { success: true, data: { name: profile?.name ?? '' } }
}

// 키오스크: 리다이렉트 없이 로그아웃 (다음 사람 대기 화면 유지)
export async function kioskSignOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
