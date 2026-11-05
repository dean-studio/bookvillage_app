'use server'

// 학원 모드(site_type === 'academy') 전용 서버 액션.
// 모든 함수는 맨 처음 requireAcademyAdmin() 으로 "승인된 관리자 + 학원 모드"를 확인한다.
// 아파트·학교·마을·유치원 사이트에서는 아무것도 읽거나 바꾸지 않고 거절한다.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import { createCardMember } from './member-cards'
import { createBook, checkBarcodeExists, generateBarcodes } from './books'
import { isAcademy } from '@/lib/site-mode'
import { parseGroups, isMemberCardCode } from '@/lib/member-card'
import { getKSTDateString } from '@/lib/date'
import { searchBookByISBN } from '@/lib/kakao'
import { searchOpenLibraryByISBN } from '@/lib/openlibrary'
import { readArFields, updateBookSchema } from '@/lib/validations/books'
import { AR_FIELD_KEYS, type ArFieldKey } from '@/lib/ar'
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  checkImportRow,
  cleanIsbn,
  normalizeImportBarcode,
  type ImportKind,
  type ImportRow,
} from '@/lib/academy-import'
import type { ActionResult } from '@/types'
import type { Database } from '@/types/supabase'

type BookUpdate = Database['public']['Tables']['books']['Update']

const NOT_ACADEMY = '학원 모드에서만 쓸 수 있습니다.'
const PAGE = 1000

async function requireAcademyAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || user.admin_status !== 'approved') {
    return { ok: false, error: '권한이 없습니다.' }
  }
  const { data } = await supabaseAdmin
    .from('library_settings')
    .select('value')
    .eq('key', 'site_type')
    .maybeSingle()
  if (!isAcademy(data?.value)) return { ok: false, error: NOT_ACADEMY }
  return { ok: true, userId: user.id }
}

// ─────────────────────────────────────────────
// 공통 도우미
// ─────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function readMemberGroups(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('library_settings')
    .select('value')
    .eq('key', 'member_groups')
    .maybeSingle()
  return parseGroups(data?.value ?? undefined)
}

async function writeMemberGroups(groups: string[]): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('library_settings')
    .upsert(
      { key: 'member_groups', value: JSON.stringify(groups), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  return !error
}

function validGroupName(name: string): string | null {
  const g = name.trim()
  if (!g || g.length > 20) return null
  return g
}

type ResidentRow = { id: string; name: string; dong_ho: string; phone_number: string; contact_phone: string | null }

/** 학생 = 회원(resident) 전체. 카드 회원('M'+10자리)과 휴대폰 회원 모두. 비회원(is_guest)은 뺀다 */
async function fetchResidents(group?: string): Promise<ResidentRow[]> {
  const out: ResidentRow[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin
      .from('profiles')
      .select('id, name, dong_ho, phone_number, contact_phone')
      .eq('role', 'resident')
      .eq('is_guest', false)
    if (group !== undefined) q = q.eq('dong_ho', group)
    const { data, error } = await q.order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}

type MemberInfo = { grade: number | null; zpd_low: number | null; zpd_high: number | null; status: string }

async function fetchMemberInfo(userIds?: string[]): Promise<Map<string, MemberInfo>> {
  const map = new Map<string, MemberInfo>()
  const put = (rows: { user_id: string; grade: number | null; zpd_low: number | null; zpd_high: number | null; status: string }[] | null) => {
    for (const r of rows ?? []) map.set(r.user_id, { grade: r.grade, zpd_low: r.zpd_low, zpd_high: r.zpd_high, status: r.status })
  }
  if (userIds) {
    for (const ids of chunk(userIds, 200)) {
      const { data } = await supabaseAdmin
        .from('academy_members')
        .select('user_id, grade, zpd_low, zpd_high, status')
        .in('user_id', ids)
      put(data)
    }
    return map
  }
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabaseAdmin
      .from('academy_members')
      .select('user_id, grade, zpd_low, zpd_high, status')
      .order('user_id')
      .range(from, from + PAGE - 1)
    put(data)
    if (!data || data.length < PAGE) break
  }
  return map
}

type ActiveRental = { id: string; user_id: string; book_id: string; rented_at: string; due_date: string; title: string; barcode: string }

async function fetchActiveRentals(userIds?: string[]): Promise<ActiveRental[]> {
  const out: ActiveRental[] = []
  const map = (rows: { id: string; user_id: string; book_id: string; rented_at: string; due_date: string; book: unknown }[] | null) => {
    for (const r of rows ?? []) {
      const b = (r.book ?? {}) as { title?: string; barcode?: string }
      out.push({ id: r.id, user_id: r.user_id, book_id: r.book_id, rented_at: r.rented_at, due_date: r.due_date, title: b.title ?? '', barcode: b.barcode ?? '' })
    }
  }
  const sel = 'id, user_id, book_id, rented_at, due_date, book:books(title, barcode)'
  if (userIds) {
    for (const ids of chunk(userIds, 200)) {
      const { data } = await supabaseAdmin.from('rentals').select(sel).is('returned_at', null).in('user_id', ids)
      map(data)
    }
    return out
  }
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabaseAdmin
      .from('rentals')
      .select(sel)
      .is('returned_at', null)
      .order('id')
      .range(from, from + PAGE - 1)
    map(data)
    if (!data || data.length < PAGE) break
  }
  return out
}

/** 학년(0~12, 0 = 미취학)·ZPD(0~13.9) 입력 확인. 빈 칸 = null */
function parseAcademyInfo(input: { grade?: string | number | null; zpd_low?: string | number | null; zpd_high?: string | number | null }):
  | { values: { grade: number | null; zpd_low: number | null; zpd_high: number | null } }
  | { error: string } {
  const toStr = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v).trim())
  const gradeRaw = toStr(input.grade).replace(/학년$/, '').trim()
  let grade: number | null = null
  if (gradeRaw !== '') {
    const n = Number(gradeRaw)
    if (!Number.isInteger(n) || n < 0 || n > 12) return { error: '학년은 0~12 숫자로 입력하세요 (미취학은 0).' }
    grade = n
  }
  const zpd = (raw: string, label: string): number | null | { error: string } => {
    if (raw === '') return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 13.9) return { error: `${label}은(는) 0~13.9 사이로 입력하세요.` }
    return Math.round(n * 10) / 10
  }
  const low = zpd(toStr(input.zpd_low), 'ZPD 하한')
  if (low !== null && typeof low === 'object') return low
  const high = zpd(toStr(input.zpd_high), 'ZPD 상한')
  if (high !== null && typeof high === 'object') return high
  if (low !== null && high !== null && low > high) return { error: 'ZPD 하한이 상한보다 클 수 없습니다.' }
  return { values: { grade, zpd_low: low, zpd_high: high } }
}

// ─────────────────────────────────────────────
// 반별 현황
// ─────────────────────────────────────────────

export type AcademyClassSummary = {
  /** 반 이름 (profiles.dong_ho). 빈 문자열 = 반 없음 */
  name: string
  /** 반 목록(설정 member_groups)에 있는 반인지 */
  listed: boolean
  students: number
  inactive: number
  rentals: number
  overdue: number
}

export async function getAcademyClassOverview(): Promise<ActionResult<{ classes: AcademyClassSummary[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  try {
    const [groups, residents, info, rentals] = await Promise.all([
      readMemberGroups(),
      fetchResidents(),
      fetchMemberInfo(),
      fetchActiveRentals(),
    ])
    const today = getKSTDateString()
    const classOf = new Map(residents.map((r) => [r.id, r.dong_ho]))
    const summary = new Map<string, AcademyClassSummary>()
    const ensure = (name: string, listed: boolean) => {
      let s = summary.get(name)
      if (!s) {
        s = { name, listed, students: 0, inactive: 0, rentals: 0, overdue: 0 }
        summary.set(name, s)
      }
      return s
    }
    for (const g of groups) ensure(g, true)
    for (const r of residents) {
      const s = ensure(r.dong_ho, false)
      if (info.get(r.id)?.status === 'inactive') s.inactive++
      else s.students++
    }
    for (const rt of rentals) {
      const name = classOf.get(rt.user_id)
      if (name === undefined) continue // 관리자·비회원 대출은 반 현황에서 뺀다
      const s = ensure(name, false)
      s.rentals++
      if (rt.due_date < today) s.overdue++
    }
    const listedOrder = new Map(groups.map((g, i) => [g, i]))
    const collator = new Intl.Collator('ko', { numeric: true })
    const classes = [...summary.values()].sort((a, b) => {
      const ai = listedOrder.get(a.name)
      const bi = listedOrder.get(b.name)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai !== undefined) return -1
      if (bi !== undefined) return 1
      if (a.name === '') return 1
      if (b.name === '') return -1
      return collator.compare(a.name, b.name)
    })
    return { success: true, data: { classes } }
  } catch {
    return { success: false, error: '반별 현황을 불러오지 못했습니다.' }
  }
}

export type AcademyStudentRental = {
  id: string
  book_id: string
  title: string
  barcode: string
  rented_at: string
  due_date: string
  is_overdue: boolean
}

export type AcademyStudent = {
  id: string
  name: string
  group: string
  is_card: boolean
  contact_phone: string | null
  grade: number | null
  zpd_low: number | null
  zpd_high: number | null
  status: 'active' | 'inactive'
  rentals: AcademyStudentRental[]
}

/** 한 반의 학생과 빌린 책. includeInactive=false 면 퇴원생은 뺀다 */
export async function getAcademyClassStudents(
  group: string,
  includeInactive: boolean
): Promise<ActionResult<{ students: AcademyStudent[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  try {
    const residents = await fetchResidents(group)
    const ids = residents.map((r) => r.id)
    const [info, rentals] = await Promise.all([fetchMemberInfo(ids), fetchActiveRentals(ids)])
    const today = getKSTDateString()
    const byUser = new Map<string, AcademyStudentRental[]>()
    for (const r of rentals) {
      const list = byUser.get(r.user_id) ?? []
      list.push({ id: r.id, book_id: r.book_id, title: r.title, barcode: r.barcode, rented_at: r.rented_at, due_date: r.due_date, is_overdue: r.due_date < today })
      byUser.set(r.user_id, list)
    }
    const collator = new Intl.Collator('ko', { numeric: true })
    const students: AcademyStudent[] = residents
      .map((r) => {
        const m = info.get(r.id)
        return {
          id: r.id,
          name: r.name,
          group: r.dong_ho,
          is_card: isMemberCardCode(r.phone_number),
          contact_phone: r.contact_phone,
          grade: m?.grade ?? null,
          zpd_low: m?.zpd_low ?? null,
          zpd_high: m?.zpd_high ?? null,
          status: (m?.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
          rentals: (byUser.get(r.id) ?? []).sort((a, b) => a.due_date.localeCompare(b.due_date)),
        }
      })
      .filter((s) => includeInactive || s.status === 'active')
      .sort((a, b) => (a.status === b.status ? collator.compare(a.name, b.name) : a.status === 'active' ? -1 : 1))
    return { success: true, data: { students } }
  } catch {
    return { success: false, error: '학생 목록을 불러오지 못했습니다.' }
  }
}

// ─────────────────────────────────────────────
// 반 이름 변경·반 이동·퇴원/복귀
// ─────────────────────────────────────────────

/** 반 이름 변경 전 확인: 바뀔 학생 수(퇴원생 포함) */
export async function previewClassRename(oldName: string): Promise<ActionResult<{ studentCount: number; listed: boolean }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const from = oldName.trim()
  if (!from) return { success: false, error: '반 이름이 비어 있습니다.' }
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .eq('dong_ho', from)
  if (error) return { success: false, error: '학생 수를 세지 못했습니다.' }
  const groups = await readMemberGroups()
  return { success: true, data: { studentCount: count ?? 0, listed: groups.includes(from) } }
}

/**
 * 반 이름 변경: 반 목록(member_groups)의 이름과 그 반 학생들의 profiles.dong_ho 를 함께 바꾼다.
 * expectedCount(미리 센 학생 수)와 지금 수가 다르면 멈춘다.
 */
export async function renameClass(
  oldName: string,
  newName: string,
  expectedCount: number
): Promise<ActionResult<{ updated: number }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const from = oldName.trim()
  const to = validGroupName(newName)
  if (!from) return { success: false, error: '바꿀 반을 골라 주세요.' }
  if (!to) return { success: false, error: '새 반 이름은 1~20자로 입력해 주세요.' }
  if (from === to) return { success: false, error: '지금 이름과 같습니다.' }

  const groups = await readMemberGroups()
  if (groups.includes(to)) return { success: false, error: `'${to}' 반이 이미 있습니다. 합치려면 학생을 골라 반 이동을 쓰세요.` }
  const { count: targetCount } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .eq('dong_ho', to)
  if ((targetCount ?? 0) > 0) return { success: false, error: `'${to}' 반에 이미 학생이 있습니다. 합치려면 학생을 골라 반 이동을 쓰세요.` }

  const { count, error: countError } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .eq('dong_ho', from)
  if (countError) return { success: false, error: '학생 수를 세지 못했습니다.' }
  if ((count ?? 0) !== expectedCount) {
    return { success: false, error: `학생 수가 확인할 때(${expectedCount}명)와 달라졌습니다(지금 ${count ?? 0}명). 다시 확인해 주세요.` }
  }

  // 1) 반 목록 이름 변경 (목록에 있을 때만)
  const listed = groups.includes(from)
  if (listed) {
    const ok = await writeMemberGroups(groups.map((g) => (g === from ? to : g)))
    if (!ok) return { success: false, error: '반 목록 저장에 실패했습니다.' }
  }

  // 2) 학생들 반 변경
  const { error, count: updated } = await supabaseAdmin
    .from('profiles')
    .update({ dong_ho: to }, { count: 'exact' })
    .eq('role', 'resident')
    .eq('dong_ho', from)
  if (error) {
    if (listed) await writeMemberGroups(groups) // 반 목록 되돌림
    return { success: false, error: '학생 반 변경에 실패했습니다. 반 목록은 원래대로 되돌렸습니다.' }
  }
  return { success: true, data: { updated: updated ?? 0 } }
}

/** 고른 학생들을 다른 반으로 옮긴다. 대상이 모두 회원(resident)이 아니면 멈춘다 */
export async function moveStudentsToClass(userIds: string[], targetGroup: string): Promise<ActionResult<{ moved: number }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const to = validGroupName(targetGroup)
  if (!to) return { success: false, error: '옮길 반 이름은 1~20자로 입력해 주세요.' }
  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return { success: false, error: '학생을 골라 주세요.' }
  if (ids.length > MAX_IMPORT_ROWS) return { success: false, error: `한 번에 ${MAX_IMPORT_ROWS}명까지 옮길 수 있습니다.` }

  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .in('id', ids)
  if ((count ?? 0) !== ids.length) return { success: false, error: '고른 학생 중 찾을 수 없는 사람이 있어 멈췄습니다. 새로고침 후 다시 해 주세요.' }

  const { error, count: moved } = await supabaseAdmin
    .from('profiles')
    .update({ dong_ho: to }, { count: 'exact' })
    .eq('role', 'resident')
    .in('id', ids)
  if (error) return { success: false, error: '반 이동에 실패했습니다.' }
  return { success: true, data: { moved: moved ?? 0 } }
}

/** 퇴원('inactive')·복귀('active'). academy_members.status 만 바꾸고 학년·ZPD 는 그대로 둔다 */
export async function setStudentsStatus(userIds: string[], status: 'active' | 'inactive'): Promise<ActionResult<{ updated: number }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (status !== 'active' && status !== 'inactive') return { success: false, error: '상태 값이 올바르지 않습니다.' }
  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return { success: false, error: '학생을 골라 주세요.' }
  if (ids.length > MAX_IMPORT_ROWS) return { success: false, error: `한 번에 ${MAX_IMPORT_ROWS}명까지 바꿀 수 있습니다.` }

  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .in('id', ids)
  if ((count ?? 0) !== ids.length) return { success: false, error: '고른 학생 중 찾을 수 없는 사람이 있어 멈췄습니다. 새로고침 후 다시 해 주세요.' }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('academy_members')
    .upsert(ids.map((user_id) => ({ user_id, status, updated_at: now })), { onConflict: 'user_id' })
  if (error) return { success: false, error: '상태 저장에 실패했습니다.' }
  return { success: true, data: { updated: ids.length } }
}

// ─────────────────────────────────────────────
// 학생 학년·ZPD
// ─────────────────────────────────────────────

export type AcademyMemberInfo = { grade: number | null; zpd_low: number | null; zpd_high: number | null; status: 'active' | 'inactive' }

export async function getStudentAcademyInfo(userId: string): Promise<ActionResult<AcademyMemberInfo>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data, error } = await supabaseAdmin
    .from('academy_members')
    .select('grade, zpd_low, zpd_high, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { success: false, error: '학원 정보를 불러오지 못했습니다.' }
  return {
    success: true,
    data: {
      grade: data?.grade ?? null,
      zpd_low: data?.zpd_low ?? null,
      zpd_high: data?.zpd_high ?? null,
      status: data?.status === 'inactive' ? 'inactive' : 'active',
    },
  }
}

export type AcademyInfoInput = { grade: string; zpd_low: string; zpd_high: string; status?: 'active' | 'inactive' }

/** 학년·ZPD(·상태) 저장 (academy_members upsert). 빈 칸 = 지우기 */
export async function saveStudentAcademyInfo(userId: string, input: AcademyInfoInput): Promise<ActionResult<AcademyMemberInfo>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = parseAcademyInfo(input)
  if ('error' in parsed) return { success: false, error: parsed.error }
  if (input.status !== undefined && input.status !== 'active' && input.status !== 'inactive') {
    return { success: false, error: '상태 값이 올바르지 않습니다.' }
  }

  const { data: target } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (!target || target.role !== 'resident') return { success: false, error: '학생을 찾을 수 없습니다.' }

  const row = { user_id: userId, ...parsed.values, updated_at: new Date().toISOString(), ...(input.status ? { status: input.status } : {}) }
  const { data, error } = await supabaseAdmin
    .from('academy_members')
    .upsert(row, { onConflict: 'user_id' })
    .select('grade, zpd_low, zpd_high, status')
    .single()
  if (error || !data) return { success: false, error: '저장에 실패했습니다.' }
  return { success: true, data: { grade: data.grade, zpd_low: data.zpd_low, zpd_high: data.zpd_high, status: data.status === 'inactive' ? 'inactive' : 'active' } }
}

export type AcademyStudentInput = {
  name: string
  group: string
  contact_phone?: string
  memo?: string
  grade?: string
  zpd_low?: string
  zpd_high?: string
}

/** 학생 등록 내부 처리: 카드 회원 생성(createCardMember 그대로) + 학년·ZPD 저장 */
async function createStudent(input: AcademyStudentInput): Promise<ActionResult<{ id: string; warning?: string }>> {
  const info = parseAcademyInfo(input)
  if ('error' in info) return { success: false, error: info.error }

  const created = await createCardMember({ name: input.name, group: input.group, contact_phone: input.contact_phone, memo: input.memo })
  if (!created.success || !created.data) return { success: false, error: created.error ?? '학생 등록에 실패했습니다.' }

  const { error } = await supabaseAdmin
    .from('academy_members')
    .upsert({ user_id: created.data.id, ...info.values, status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    return { success: true, data: { id: created.data.id, warning: '학생은 등록됐지만 학년·레벨 저장에 실패했습니다. 회원 상세에서 다시 저장해 주세요.' } }
  }
  return { success: true, data: { id: created.data.id } }
}

/** 관리자 화면 "회원 추가"(학원일 때): 카드 회원 생성 + 학년·ZPD */
export async function createAcademyStudent(input: AcademyStudentInput): Promise<ActionResult<{ id: string; warning?: string }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  return createStudent(input)
}

/** 반 목록(member_groups)에 없는 반 이름을 뒤에 추가한다 */
export async function ensureClasses(names: string[]): Promise<ActionResult<{ added: string[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const groups = await readMemberGroups()
  const added: string[] = []
  for (const n of names) {
    const g = validGroupName(n)
    if (g && !groups.includes(g) && !added.includes(g)) added.push(g)
  }
  if (added.length === 0) return { success: true, data: { added } }
  if (added.length > 100) return { success: false, error: '새 반이 너무 많습니다 (100개까지).' }
  const ok = await writeMemberGroups([...groups, ...added])
  if (!ok) return { success: false, error: '반 목록 저장에 실패했습니다.' }
  return { success: true, data: { added } }
}

// ─────────────────────────────────────────────
// 엑셀 일괄 (서버는 화면에서 파싱한 JSON 배열만 받는다)
// ─────────────────────────────────────────────

export type ImportLineResult = { line: number; ok: boolean; message: string }

/** 받은 줄 정리: 아는 칸만, 문자열만, 최대 500줄 */
function sanitizeRows(kind: ImportKind, rows: ImportRow[]): ImportRow[] | null {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_IMPORT_ROWS) return null
  const keys = IMPORT_COLUMNS[kind].map((c) => c.key)
  return rows.map((r) => {
    const values: Record<string, string> = {}
    for (const k of keys) {
      const v = r?.values?.[k]
      values[k] = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
    }
    return { line: Number.isInteger(r?.line) ? r.line : 0, values }
  })
}

function rowsError(): string {
  return `한 번에 1~${MAX_IMPORT_ROWS}줄을 보낼 수 있습니다.`
}

/** AR 칸 값 → DB에 넣을 값. 빈 칸은 넣지 않는다(= 바꾸지 않음). 기존 zod 스키마로 확인 */
function parseArUpdate(values: Partial<Record<ArFieldKey, string>>):
  | { data: BookUpdate }
  | { error: string } {
  const fd = new FormData()
  for (const k of AR_FIELD_KEYS) {
    const v = (values[k] ?? '').trim()
    if (v !== '') fd.set(k, v)
  }
  const parsed = updateBookSchema.safeParse(readArFields(fd))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const out: Record<string, unknown> = {}
  for (const k of AR_FIELD_KEYS) {
    const v = (parsed.data as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = v
  }
  return { data: out as BookUpdate }
}

/** 미리보기용: 이미 등록된(삭제 안 된) 책이 있는 ISBN 목록 */
export async function findExistingIsbns(isbns: string[]): Promise<ActionResult<{ existing: string[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const clean = [...new Set(isbns.map((s) => cleanIsbn(String(s ?? ''))).filter((s): s is string => !!s))].slice(0, MAX_IMPORT_ROWS)
  const existing = new Set<string>()
  for (const part of chunk(clean, 100)) {
    // isbn 칸에는 "ISBN10 ISBN13" 처럼 두 개가 들어 있는 경우가 많아 바코드와 함께 본다
    const { data } = await supabaseAdmin
      .from('books')
      .select('isbn, barcode')
      .eq('is_deleted', false)
      .or(part.flatMap((i) => [`barcode.eq.${i}`, `isbn.ilike.%${i}%`]).join(','))
    for (const b of data ?? []) {
      const tokens = String(b.isbn ?? '').split(/[\s,]+/)
      for (const i of part) if (b.barcode === i || tokens.includes(i)) existing.add(i)
    }
  }
  return { success: true, data: { existing: [...existing] } }
}

type LookedUpBook = {
  title: string
  author: string
  publisher: string
  cover_image: string
  description: string
  isbn: string
  translators: string
  published_at: string
  price: number
  sale_price: number
  category: string
  kakao_url: string
  sale_status: string
}

/** 도서 등록 화면과 같은 ISBN 조회: 카카오 → (설정 isbn_fallback === 'openlibrary' 일 때만) Open Library */
async function lookupIsbn(isbn: string, fallbackOn: boolean): Promise<LookedUpBook | null> {
  try {
    const book = await searchBookByISBN(isbn)
    if (book) {
      return {
        title: book.title,
        author: book.authors.join(', '),
        publisher: book.publisher,
        cover_image: book.thumbnail,
        description: book.contents,
        isbn: book.isbn,
        translators: book.translators.join(', '),
        published_at: book.datetime ? book.datetime.slice(0, 10) : '',
        price: book.price,
        sale_price: book.sale_price,
        category: book.category,
        kakao_url: book.url,
        sale_status: book.status,
      }
    }
  } catch {
    // 카카오 오류는 "못 찾음"으로 보고 엑셀 값으로 계속
  }
  if (!fallbackOn) return null
  const ol = await searchOpenLibraryByISBN(isbn)
  if (!ol) return null
  return {
    title: ol.title,
    author: ol.author,
    publisher: ol.publisher,
    cover_image: ol.cover_image,
    description: '',
    isbn: ol.isbn,
    translators: '',
    published_at: ol.published_at,
    price: 0,
    sale_price: 0,
    category: '',
    kakao_url: '',
    sale_status: '',
  }
}

/**
 * (a) 도서 일괄 등록. 줄마다 기존 createBook 을 그대로 부른다(검증·삭제된 같은 바코드 복원·중복 오류 동일).
 * 바코드: 엑셀 바코드 칸 > ISBN(이미 쓰이면 자체 바코드 자동 발급, 복본) > 자체 바코드 자동 발급.
 * 엑셀에 적은 값이 우선이고, 빈 칸만 ISBN 조회 결과로 채운다.
 */
export async function importBooks(
  rows: ImportRow[],
  options: { lookup: boolean; defaultShelf?: string }
): Promise<ActionResult<{ results: ImportLineResult[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const clean = sanitizeRows('books', rows)
  if (!clean) return { success: false, error: rowsError() }

  const { data: shelfRows } = await supabaseAdmin.from('shelves').select('name').eq('type', 'shelf')
  const shelfNames = new Set((shelfRows ?? []).map((s) => s.name))
  const { data: fb } = await supabaseAdmin.from('library_settings').select('value').eq('key', 'isbn_fallback').maybeSingle()
  const fallbackOn = fb?.value === 'openlibrary'
  const defaultShelf = (options.defaultShelf ?? '').trim()

  const results: ImportLineResult[] = []
  for (const { line, values: v } of clean) {
    const fail = (message: string) => results.push({ line, ok: false, message })
    const check = checkImportRow('books', v)
    if (check) { fail(check); continue }

    const shelf = v.shelf || defaultShelf
    if (!shelf) { fail('책장이 비어 있습니다. 책장 칸을 채우거나 기본 책장을 고르세요.'); continue }
    if (!shelfNames.has(shelf)) { fail(`'${shelf}' 책장이 없습니다. 책장 이름을 확인하세요.`); continue }

    const isbn = v.isbn ? cleanIsbn(v.isbn) : null
    const found = options.lookup && isbn ? await lookupIsbn(isbn, fallbackOn) : null
    const title = v.title || found?.title || ''
    if (!title) { fail('제목이 없고 ISBN으로도 책 정보를 찾지 못했습니다.'); continue }

    // 바코드 정하기
    let barcode = ''
    let note = ''
    if (v.barcode) {
      barcode = normalizeImportBarcode(v.barcode)
      const existing = await checkBarcodeExists(barcode)
      if (existing.exists) { fail(`이미 사용 중인 바코드입니다: ${barcode} (${existing.book?.title ?? ''})`); continue }
    } else if (isbn && !(await checkBarcodeExists(isbn)).exists) {
      barcode = isbn
    } else {
      const gen = await generateBarcodes(1)
      if (!gen.success || !gen.data?.codes[0]) { fail('바코드 자동 생성에 실패했습니다.'); continue }
      barcode = gen.data.codes[0]
      note = isbn ? ' · 같은 ISBN 책이 있어 자체 바코드를 붙였습니다(복본)' : ' · 자체 바코드 자동 발급'
    }

    const fd = new FormData()
    fd.set('barcode', barcode)
    fd.set('title', title)
    fd.set('author', v.author || found?.author || '')
    fd.set('publisher', v.publisher || found?.publisher || '')
    fd.set('cover_image', found?.cover_image || '')
    fd.set('description', found?.description || '')
    fd.set('isbn', found?.isbn || isbn || '')
    fd.set('translators', found?.translators || '')
    fd.set('published_at', found?.published_at || '')
    fd.set('price', String(found?.price || 0))
    fd.set('sale_price', String(found?.sale_price || 0))
    fd.set('category', found?.category || '')
    fd.set('kakao_url', found?.kakao_url || '')
    fd.set('sale_status', found?.sale_status || '')
    fd.set('location_group', shelf)
    fd.set('location_detail', v.location_detail || '')
    // AR 칸: 값이 있는 칸만 보낸다
    for (const k of AR_FIELD_KEYS) if (v[k]) fd.set(k, v[k])

    const result = await createBook(fd)
    if (!result.success) { fail(result.error ?? '도서 등록에 실패했습니다.'); continue }
    const how = found ? '' : isbn && options.lookup ? ' · ISBN 정보 없음(엑셀 값으로 등록)' : ''
    results.push({ line, ok: true, message: `${title} → ${barcode}${note}${how}` })
  }
  return { success: true, data: { results } }
}

type BookMatch = { id: string; title: string; author: string; isbn: string; barcode: string }

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** AR 일괄 입력에서 책 찾기: ISBN → 바코드 → 제목(정확 일치, 대소문자 무시) */
async function findBooksForAr(v: Record<string, string>): Promise<
  { kind: 'found'; books: BookMatch[]; by: string } | { kind: 'not_found' } | { kind: 'ambiguous'; books: BookMatch[] }
> {
  const sel = 'id, title, author, isbn, barcode'
  const isbn = v.isbn ? cleanIsbn(v.isbn) : null
  if (isbn) {
    const { data } = await supabaseAdmin
      .from('books')
      .select(sel)
      .eq('is_deleted', false)
      .or(`barcode.eq.${isbn},isbn.ilike.%${isbn}%`)
      .limit(200)
    const books = (data ?? []).filter((b) => b.barcode === isbn || String(b.isbn ?? '').split(/[\s,]+/).includes(isbn))
    // 같은 ISBN = 복본 → 모두 갱신
    if (books.length > 0) return { kind: 'found', books, by: 'ISBN' }
  }
  if (v.barcode) {
    const codes = [...new Set([v.barcode.trim().toUpperCase(), normalizeImportBarcode(v.barcode)])].filter(Boolean)
    const { data } = await supabaseAdmin.from('books').select(sel).eq('is_deleted', false).in('barcode', codes)
    if (data && data.length > 0) return { kind: 'found', books: data, by: '바코드' }
  }
  const title = v.title?.trim()
  if (title) {
    const { data } = await supabaseAdmin
      .from('books')
      .select(sel)
      .eq('is_deleted', false)
      .ilike('title', escapeLike(title))
      .limit(50)
    const books = (data ?? []).filter((b) => b.title.trim().toLowerCase() === title.toLowerCase())
    if (books.length === 1) return { kind: 'found', books, by: '제목' }
    if (books.length > 1) {
      // 저자·ISBN 이 모두 같으면 같은 책의 복본으로 보고 모두 갱신, 다르면 어느 책인지 몰라 건너뛴다
      const sig = (b: BookMatch) => `${(b.author ?? '').trim().toLowerCase()}|${(b.isbn ?? '').trim()}`
      if (new Set(books.map(sig)).size === 1) return { kind: 'found', books, by: '제목(복본)' }
      return { kind: 'ambiguous', books }
    }
  }
  return { kind: 'not_found' }
}

export type ArImportLineResult = ImportLineResult & {
  status: 'updated' | 'not_found' | 'ambiguous' | 'error'
  /** 여러 권 걸린 줄: 후보 책 */
  candidates?: { title: string; author: string; barcode: string }[]
}

/** (b) AR 정보 일괄 입력: 찾은 책의 AR 칸만 갱신(빈 칸은 그대로 둠) */
export async function importArInfo(rows: ImportRow[]): Promise<ActionResult<{ results: ArImportLineResult[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const clean = sanitizeRows('ar', rows)
  if (!clean) return { success: false, error: rowsError() }

  const results: ArImportLineResult[] = []
  for (const { line, values: v } of clean) {
    const check = checkImportRow('ar', v)
    if (check) { results.push({ line, ok: false, status: 'error', message: check }); continue }
    const ar = parseArUpdate(v)
    if ('error' in ar) { results.push({ line, ok: false, status: 'error', message: ar.error }); continue }
    if (Object.keys(ar.data).length === 0) { results.push({ line, ok: false, status: 'error', message: 'AR 정보 칸이 모두 비어 있습니다.' }); continue }

    const match = await findBooksForAr(v)
    if (match.kind === 'not_found') {
      results.push({ line, ok: false, status: 'not_found', message: '책을 찾지 못했습니다.' })
      continue
    }
    if (match.kind === 'ambiguous') {
      results.push({
        line,
        ok: false,
        status: 'ambiguous',
        message: `같은 제목의 다른 책이 ${match.books.length}권 있어 건너뛰었습니다. ISBN이나 바코드로 다시 넣어 주세요.`,
        candidates: match.books.map((b) => ({ title: b.title, author: b.author, barcode: b.barcode })),
      })
      continue
    }
    const ids = match.books.map((b) => b.id)
    const { error, count } = await supabaseAdmin.from('books').update(ar.data, { count: 'exact' }).in('id', ids)
    if (error) { results.push({ line, ok: false, status: 'error', message: 'AR 정보 저장에 실패했습니다.' }); continue }
    const n = count ?? ids.length
    results.push({
      line,
      ok: true,
      status: 'updated',
      message: `${match.books[0].title} · ${match.by}로 찾음${n > 1 ? ` · ${n}권 갱신` : ''}`,
    })
  }
  return { success: true, data: { results } }
}

/** (c) 학생 일괄 등록. 같은 반에 같은 이름이 이미 있으면 skipDuplicates=true 일 때 건너뛴다 */
export async function importStudents(
  rows: ImportRow[],
  options: { skipDuplicates: boolean }
): Promise<ActionResult<{ results: ImportLineResult[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const clean = sanitizeRows('students', rows)
  if (!clean) return { success: false, error: rowsError() }

  const results: ImportLineResult[] = []
  for (const { line, values: v } of clean) {
    const check = checkImportRow('students', v)
    if (check) { results.push({ line, ok: false, message: check }); continue }
    if (options.skipDuplicates) {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'resident')
        .eq('name', v.name)
        .eq('dong_ho', v.group)
      if ((count ?? 0) > 0) { results.push({ line, ok: false, message: `'${v.group}' 반에 '${v.name}' 학생이 이미 있어 건너뛰었습니다.` }); continue }
    }
    const created = await createStudent({
      name: v.name,
      group: v.group,
      contact_phone: v.contact_phone,
      memo: v.memo,
      grade: v.grade,
    })
    if (!created.success) { results.push({ line, ok: false, message: created.error ?? '학생 등록에 실패했습니다.' }); continue }
    results.push({ line, ok: true, message: `${v.group} · ${v.name}${created.data?.warning ? ` (${created.data.warning})` : ''}` })
  }
  return { success: true, data: { results } }
}

// ─────────────────────────────────────────────
// AR 정보 없는 책
// ─────────────────────────────────────────────

export type ArMissingGroup = {
  /** 이 묶음의 책 id (같은 ISBN 복본은 한 줄로 묶음) */
  ids: string[]
  title: string
  author: string
  publisher: string | null
  isbn: string
  barcodes: string[]
  shelf: string
}

/** AR 레벨이 비어 있는 책 (같은 ISBN은 한 줄). 제목 가나다순, 페이지 단위 */
export async function getBooksMissingAr(params: { q?: string; page?: number; limit?: number }): Promise<
  ActionResult<{ groups: ArMissingGroup[]; totalGroups: number; totalBooks: number; page: number; totalPages: number; truncated: boolean }>
> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const page = Math.max(1, Math.floor(params.page ?? 1))
  const limit = Math.min(100, Math.max(5, Math.floor(params.limit ?? 30)))
  const q = (params.q ?? '').trim().replace(/[%_,()"\\]/g, '')
  const MAX_BOOKS = 10000

  type Row = { id: string; title: string; author: string; publisher: string | null; isbn: string; barcode: string; location_group: string }
  const all: Row[] = []
  let truncated = false
  for (let from = 0; ; from += PAGE) {
    let query = supabaseAdmin
      .from('books')
      .select('id, title, author, publisher, isbn, barcode, location_group')
      .eq('is_deleted', false)
      .is('ar_level', null)
    if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,barcode.ilike.%${q}%,isbn.ilike.%${q}%`)
    const { data, error } = await query.order('id').range(from, from + PAGE - 1)
    if (error) return { success: false, error: '책 목록을 불러오지 못했습니다.' }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
    if (all.length >= MAX_BOOKS) { truncated = true; break }
  }

  const groups = new Map<string, ArMissingGroup>()
  for (const b of all) {
    const tokens = String(b.isbn ?? '').split(/[\s,]+/).filter((t) => cleanIsbn(t))
    const key = tokens.length > 0 ? `isbn:${tokens.sort().join(' ')}` : `id:${b.id}`
    const g = groups.get(key)
    if (g) {
      g.ids.push(b.id)
      g.barcodes.push(b.barcode)
    } else {
      groups.set(key, { ids: [b.id], title: b.title, author: b.author, publisher: b.publisher, isbn: b.isbn, barcodes: [b.barcode], shelf: b.location_group })
    }
  }
  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })
  const sorted = [...groups.values()].sort((a, b) => collator.compare(a.title || '', b.title || ''))
  const totalGroups = sorted.length
  const offset = (page - 1) * limit
  return {
    success: true,
    data: {
      groups: sorted.slice(offset, offset + limit),
      totalGroups,
      totalBooks: all.length,
      page,
      totalPages: Math.max(1, Math.ceil(totalGroups / limit)),
      truncated,
    },
  }
}

export type ArBatchItem = { ids: string[]; values: Partial<Record<ArFieldKey, string>> }

/** AR 정보 여러 권 한 번에 저장. 줄마다 결과를 돌려준다(index = 보낸 순서) */
export async function saveArBatch(items: ArBatchItem[]): Promise<ActionResult<{ results: { index: number; ok: boolean; message: string; count: number }[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_IMPORT_ROWS) return { success: false, error: rowsError() }

  const results: { index: number; ok: boolean; message: string; count: number }[] = []
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const ids = [...new Set((item?.ids ?? []).filter((x) => typeof x === 'string' && x))]
    if (ids.length === 0 || ids.length > 200) { results.push({ index, ok: false, message: '책이 올바르지 않습니다.', count: 0 }); continue }
    const ar = parseArUpdate(item.values ?? {})
    if ('error' in ar) { results.push({ index, ok: false, message: ar.error, count: 0 }); continue }
    if (Object.keys(ar.data).length === 0) { results.push({ index, ok: false, message: '입력한 값이 없습니다.', count: 0 }); continue }
    const { error, count } = await supabaseAdmin
      .from('books')
      .update(ar.data, { count: 'exact' })
      .in('id', ids)
      .eq('is_deleted', false)
    if (error) { results.push({ index, ok: false, message: '저장에 실패했습니다.', count: 0 }); continue }
    results.push({ index, ok: true, message: '저장됨', count: count ?? 0 })
  }
  return { success: true, data: { results } }
}
