'use server'

// 학원 모드(site_type === 'academy') 전용 서버 액션.
// 모든 함수는 맨 처음 requireAcademyAdmin() 으로 "승인된 관리자 + 학원 모드"를 확인한다.
// 아파트·학교·마을·유치원 사이트에서는 아무것도 읽거나 바꾸지 않고 거절한다.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import { createCardMember } from './member-cards'
import { createBook, checkBarcodeExists, generateBarcodes } from './books'
import { isAcademy, isFlagOn } from '@/lib/site-mode'
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
  restorePhoneLeadingZero,
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

/**
 * 반 목록(member_groups)에 없는 반 이름을 뒤에 추가한다 (서버 안에서만 부름).
 * 반 이동·학생 일괄 등록이 끝난 뒤 로그인·회원 추가 화면의 반 버튼에 새 반이 나오게 하려는 것.
 */
async function addMissingClasses(names: string[]): Promise<{ ok: true; added: string[] } | { ok: false; error: string }> {
  const groups = await readMemberGroups()
  const added: string[] = []
  for (const n of names) {
    const g = validGroupName(n)
    if (g && !groups.includes(g) && !added.includes(g)) added.push(g)
  }
  if (added.length === 0) return { ok: true, added }
  if (added.length > 100) return { ok: false, error: '새 반이 너무 많아(100개 넘음) 반 목록에 추가하지 않았습니다.' }
  const saved = await writeMemberGroups([...groups, ...added])
  if (!saved) return { ok: false, error: '반 목록 저장에 실패했습니다. 관리 → 반 설정에서 직접 추가해 주세요.' }
  return { ok: true, added }
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
  // 반별 현황(fetchResidents)과 같은 기준: 회원(resident)이면서 비회원(is_guest) 아님
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .eq('is_guest', false)
    .eq('dong_ho', from)
  if (error) return { success: false, error: '학생 수를 세지 못했습니다.' }
  const groups = await readMemberGroups()
  return { success: true, data: { studentCount: count ?? 0, listed: groups.includes(from) } }
}

/**
 * 반 이름 변경: 그 반 학생들의 profiles.dong_ho 를 먼저 바꾸고, 그다음 반 목록(member_groups)의 이름을 바꾼다.
 * - 대상 = 회원(resident)이면서 비회원(is_guest) 아님 (반별 현황과 같은 기준)
 * - expectedCount(미리 센 학생 수)와 지금 수가 다르면 바꾸기 전에 멈춘다.
 * - 실제로 바뀐 수가 expectedCount 와 다르면 결과에 알림(notice)을 넣는다.
 * - 반 목록 저장이 실패하면 학생 반을 되돌리고, 되돌리기도 실패하면 그 사실을 오류 문구에 적는다.
 */
export async function renameClass(
  oldName: string,
  newName: string,
  expectedCount: number
): Promise<ActionResult<{ updated: number; notice?: string }>> {
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
    .eq('is_guest', false)
    .eq('dong_ho', to)
  if ((targetCount ?? 0) > 0) return { success: false, error: `'${to}' 반에 이미 학생이 있습니다. 합치려면 학생을 골라 반 이동을 쓰세요.` }

  const { count, error: countError } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'resident')
    .eq('is_guest', false)
    .eq('dong_ho', from)
  if (countError) return { success: false, error: '학생 수를 세지 못했습니다.' }
  if ((count ?? 0) !== expectedCount) {
    return { success: false, error: `학생 수가 확인할 때(${expectedCount}명)와 달라졌습니다(지금 ${count ?? 0}명). 다시 확인해 주세요.` }
  }

  // 1) 학생들 반 변경 (바뀐 행을 돌려받아 실제 수를 센다)
  const { data: changed, error } = await supabaseAdmin
    .from('profiles')
    .update({ dong_ho: to })
    .eq('role', 'resident')
    .eq('is_guest', false)
    .eq('dong_ho', from)
    .select('id')
  if (error) return { success: false, error: '학생 반 변경에 실패했습니다. 바뀐 것은 없습니다.' }
  const changedIds = (changed ?? []).map((r) => r.id)
  const updated = changedIds.length
  const notice =
    updated !== expectedCount
      ? `확인할 때는 ${expectedCount}명이었는데 실제로 ${updated}명의 반이 바뀌었습니다. 반별 현황에서 확인해 주세요.`
      : undefined

  // 2) 반 목록 이름 변경 (목록에 있을 때만)
  if (groups.includes(from)) {
    const ok = await writeMemberGroups(groups.map((g) => (g === from ? to : g)))
    if (!ok) {
      // 학생 반 되돌림 (방금 바꾼 학생만)
      let reverted = true
      for (const ids of chunk(changedIds, 200)) {
        const { error: revertError } = await supabaseAdmin.from('profiles').update({ dong_ho: from }).in('id', ids).eq('dong_ho', to)
        if (revertError) reverted = false
      }
      return {
        success: false,
        error: reverted
          ? '반 목록 저장에 실패해 학생 반을 원래대로 되돌렸습니다. 다시 시도해 주세요.'
          : `반 목록 저장에 실패했고, 학생 반 되돌리기도 실패했습니다. 학생 일부(최대 ${updated}명)는 '${to}' 반으로 바뀌어 있습니다. 반별 현황에서 확인한 뒤 다시 시도해 주세요.`,
      }
    }
  }
  return { success: true, data: { updated, notice } }
}

/** 고른 학생들을 다른 반으로 옮긴다. 대상이 모두 회원(resident)이 아니면 멈춘다 */
export async function moveStudentsToClass(userIds: string[], targetGroup: string): Promise<ActionResult<{ moved: number; addedClass: boolean; warning?: string }>> {
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
  // 반 목록에 없던 새 반이면 목록에도 추가 (로그인·회원 추가 화면 반 버튼에 나오게)
  const classes = await addMissingClasses([to])
  if (!classes.ok) return { success: true, data: { moved: moved ?? 0, addedClass: false, warning: classes.error } }
  return { success: true, data: { moved: moved ?? 0, addedClass: classes.added.length > 0 } }
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

/** 퇴원(academy_members.status = 'inactive') 학생 id 목록. QR 카드 인쇄 화면에서 학원일 때만 부른다 */
export async function getInactiveStudentIds(): Promise<ActionResult<{ ids: string[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const ids: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('academy_members')
      .select('user_id')
      .eq('status', 'inactive')
      .order('user_id')
      .range(from, from + PAGE - 1)
    if (error) return { success: false, error: '퇴원생 목록을 불러오지 못했습니다.' }
    ids.push(...(data ?? []).map((r) => r.user_id))
    if (!data || data.length < PAGE) break
  }
  return { success: true, data: { ids } }
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

// ─────────────────────────────────────────────
// 엑셀 일괄 (서버는 화면에서 파싱한 JSON 배열만 받는다)
// ─────────────────────────────────────────────

export type ImportLineResult = {
  line: number
  ok: boolean
  message: string
  /** 실패가 아니라 일부러 건너뛴 줄 (이미 있는 책·학생) */
  skipped?: boolean
}

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

/**
 * 이미 등록된(삭제 안 된) 책이 있는 ISBN (정리된 ISBN 목록 중에서).
 * isbn 칸에는 "ISBN10 ISBN13" 처럼 두 개가 들어 있는 경우가 많아 바코드와 함께 본다. 조회 실패면 throw.
 */
async function queryExistingIsbns(clean: string[]): Promise<Set<string>> {
  const existing = new Set<string>()
  for (const part of chunk(clean, 100)) {
    const { data, error } = await supabaseAdmin
      .from('books')
      .select('isbn, barcode')
      .eq('is_deleted', false)
      .or(part.flatMap((i) => [`barcode.eq.${i}`, `isbn.ilike.%${i}%`]).join(','))
    if (error) throw new Error(error.message)
    for (const b of data ?? []) {
      const tokens = String(b.isbn ?? '').split(/[\s,]+/)
      for (const i of part) if (b.barcode === i || tokens.includes(i)) existing.add(i)
    }
  }
  return existing
}

/** 미리보기용: 이미 등록된(삭제 안 된) 책이 있는 ISBN 목록 */
export async function findExistingIsbns(isbns: string[]): Promise<ActionResult<{ existing: string[] }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const clean = [...new Set(isbns.map((s) => cleanIsbn(String(s ?? ''))).filter((s): s is string => !!s))].slice(0, MAX_IMPORT_ROWS)
  try {
    return { success: true, data: { existing: [...(await queryExistingIsbns(clean))] } }
  } catch {
    return { success: false, error: '이미 있는 책을 확인하지 못했습니다.' }
  }
}

/** 일괄 등록의 카카오 ISBN 조회 시간 제한 (다른 화면의 조회는 시간 제한 없이 그대로) */
const IMPORT_LOOKUP_TIMEOUT_MS = 5000

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
    const book = await searchBookByISBN(isbn, { timeoutMs: IMPORT_LOOKUP_TIMEOUT_MS })
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
 * skipExisting=true 면 줄마다 등록 직전에 같은 ISBN 책이 있는지 DB에서 다시 확인해 건너뛴다
 * (미리보기 뒤에 등록된 책·같은 파일 앞줄에서 방금 등록된 책·다시 실행한 경우 모두 막음).
 */
export async function importBooks(
  rows: ImportRow[],
  options: { lookup: boolean; defaultShelf?: string; skipExisting?: boolean }
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
    if (options.skipExisting && isbn) {
      let exists: boolean
      try {
        exists = (await queryExistingIsbns([isbn])).has(isbn)
      } catch {
        fail('같은 ISBN 책이 있는지 확인하지 못해 등록하지 않았습니다. 다시 시도해 주세요.')
        continue
      }
      if (exists) { results.push({ line, ok: false, skipped: true, message: '건너뜀: 이미 있는 책(같은 ISBN)' }); continue }
    }
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

/** 저자 비교용: 공백·구두점·기호를 빼고 소문자로 (글자·숫자만 남김) */
function authorKey(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

/** 저자가 맞는지: 둘 다 비어 있지 않고, 한쪽이 다른 쪽을 포함하면 같다고 본다 ("E. B. White" ↔ "White, E.B." 는 안 맞음 — 부분 포함만) */
function authorMatches(bookAuthor: string | null | undefined, csvAuthor: string): boolean {
  const a = authorKey(bookAuthor)
  const b = authorKey(csvAuthor)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** AR 일괄 입력에서 책 찾기: ISBN → 바코드 → 제목(정확 일치, 대소문자 무시. 엑셀에 저자가 있으면 저자도 맞는 책만) */
async function findBooksForAr(v: Record<string, string>): Promise<
  | { kind: 'found'; books: BookMatch[]; by: string }
  | { kind: 'not_found' }
  | { kind: 'ambiguous'; books: BookMatch[] }
  | { kind: 'author_mismatch'; books: BookMatch[] }
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
    const sameTitle = (data ?? []).filter((b) => b.title.trim().toLowerCase() === title.toLowerCase())
    if (sameTitle.length === 0) return { kind: 'not_found' }
    const csvAuthor = (v.author ?? '').trim()
    // 엑셀에 저자가 있으면 저자도 맞는 책만 (후보가 1권이어도 저자가 다르면 건너뜀)
    const books = csvAuthor ? sameTitle.filter((b) => authorMatches(b.author, csvAuthor)) : sameTitle
    if (books.length === 0) return { kind: 'author_mismatch', books: sameTitle }
    const by = csvAuthor ? '제목·저자' : '제목'
    if (books.length === 1) return { kind: 'found', books, by }
    // 여러 권: 저자·ISBN 이 모두 같으면 같은 책의 복본으로 보고 모두 갱신.
    // 저자·ISBN 이 모두 빈 책이 여러 권이면 같은 책인지 알 수 없어 건너뛴다. 서로 다르면 건너뛴다.
    const sig = (b: BookMatch) => `${authorKey(b.author)}|${String(b.isbn ?? '').trim()}`
    const sigs = new Set(books.map(sig))
    if (sigs.size === 1 && !sigs.has('|')) return { kind: 'found', books, by: `${by}(복본)` }
    return { kind: 'ambiguous', books }
  }
  return { kind: 'not_found' }
}

/** 결과 문구용 바코드 목록: 3개까지 쓰고 나머지는 "외 n권" */
function barcodeList(books: BookMatch[]): string {
  const codes = books.map((b) => b.barcode).filter(Boolean)
  if (codes.length === 0) return '바코드 없음'
  return codes.length > 3 ? `${codes.slice(0, 3).join(', ')} 외 ${codes.length - 3}권` : codes.join(', ')
}

export type ArImportLineResult = ImportLineResult & {
  status: 'updated' | 'not_found' | 'ambiguous' | 'author_mismatch' | 'error'
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
        message: `같은 제목의 책이 ${match.books.length}권 있는데 같은 책인지 알 수 없어 건너뛰었습니다. ISBN이나 바코드(또는 저자)로 다시 넣어 주세요.`,
        candidates: match.books.map((b) => ({ title: b.title, author: b.author, barcode: b.barcode })),
      })
      continue
    }
    if (match.kind === 'author_mismatch') {
      results.push({
        line,
        ok: false,
        status: 'author_mismatch',
        message: `제목이 같은 책은 있지만 저자가 엑셀('${v.author}')과 달라 건너뛰었습니다. ISBN이나 바코드로 다시 넣어 주세요.`,
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
      message: `${match.books[0].title} · ${match.books[0].author || '저자 없음'} · ${barcodeList(match.books)} · ${match.by}로 찾음${n > 1 ? ` · ${n}권 갱신` : ''}`,
    })
  }
  return { success: true, data: { results } }
}

/**
 * (c) 학생 일괄 등록. 같은 반에 같은 이름이 이미 있으면 skipDuplicates=true 일 때 건너뛴다.
 * 반 목록(member_groups)에 없는 반은 등록 전에 서버에서 목록에 추가한다.
 */
export async function importStudents(
  rows: ImportRow[],
  options: { skipDuplicates: boolean }
): Promise<ActionResult<{ results: ImportLineResult[]; addedClasses: string[]; classWarning?: string }>> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const clean = sanitizeRows('students', rows)
  if (!clean) return { success: false, error: rowsError() }

  // 엑셀이 지운 보호자 연락처 앞 0 복원 (화면 미리보기에서도 고쳐 보내지만 서버에서도 한 번 더)
  for (const r of clean) {
    const fixed = restorePhoneLeadingZero(r.values.contact_phone ?? '')
    if (fixed) r.values.contact_phone = fixed
  }

  // 새 반을 반 목록에 추가 (확인을 통과한 줄의 반만)
  const classes = await addMissingClasses(clean.filter((r) => !checkImportRow('students', r.values)).map((r) => r.values.group))
  const addedClasses = classes.ok ? classes.added : []
  const classWarning = classes.ok ? undefined : classes.error

  const results: ImportLineResult[] = []
  for (const { line, values: v } of clean) {
    const check = checkImportRow('students', v)
    if (check) { results.push({ line, ok: false, message: check }); continue }
    if (options.skipDuplicates) {
      // 반별 현황과 같은 기준: 회원(resident)이면서 비회원(is_guest) 아님
      const { count, error: dupError } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'resident')
        .eq('is_guest', false)
        .eq('name', v.name)
        .eq('dong_ho', v.group)
      if (dupError) { results.push({ line, ok: false, message: '같은 학생이 있는지 확인하지 못해 등록하지 않았습니다. 다시 시도해 주세요.' }); continue }
      if ((count ?? 0) > 0) { results.push({ line, ok: false, skipped: true, message: `건너뜀: '${v.group}' 반에 '${v.name}' 학생이 이미 있습니다.` }); continue }
    }
    const created = await createStudent({
      name: v.name,
      group: v.group,
      contact_phone: v.contact_phone,
      memo: v.memo,
      grade: v.grade,
      zpd_low: v.zpd_low,
      zpd_high: v.zpd_high,
    })
    if (!created.success) { results.push({ line, ok: false, message: created.error ?? '학생 등록에 실패했습니다.' }); continue }
    results.push({ line, ok: true, message: `${v.group} · ${v.name}${created.data?.warning ? ` (${created.data.warning})` : ''}` })
  }
  return { success: true, data: { results, addedClasses, classWarning } }
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
  // PostgREST or() 구분 문자(쉼표·괄호·따옴표)는 빼고, LIKE 특수 문자(% _ \)는 escapeLike 로 글자 그대로 찾게 한다
  const qRaw = (params.q ?? '').trim().replace(/[,()"]/g, '')
  const q = qRaw ? escapeLike(qRaw) : ''
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

// ─────────────────────────────────────────────
// 3단계: AR 퀴즈 통과 기록·포인트 랭킹·레벨 라벨
// 학원 모드 + 설정 ar_enabled === 'on' 일 때만 쓴다. 젤리·quiz_attempts·rentals 는 읽기만 하고 바꾸지 않는다.
// ─────────────────────────────────────────────

const AR_OFF = 'AR 정보 사용(관리 → AR 설정)이 켜져 있을 때만 쓸 수 있습니다.'

/** 학원 모드 + ar_enabled === 'on' 확인 (관리자) */
async function requireAcademyArAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const auth = await requireAcademyAdmin()
  if (!auth.ok) return auth
  const { data } = await supabaseAdmin
    .from('library_settings')
    .select('value')
    .eq('key', 'ar_enabled')
    .maybeSingle()
  if (!isFlagOn({ ar_enabled: data?.value }, 'ar_enabled')) return { ok: false, error: AR_OFF }
  return auth
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 포인트 합계: 소수 첫째 자리까지 (부동소수 오차 정리) */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** 'YYYY-MM-DD' (KST) → 그날 0시의 timestamptz 문자열 */
function kstDayStart(d: string): string {
  return `${d}T00:00:00+09:00`
}
/** 'YYYY-MM-DD' (KST) → 다음날 0시(KST)의 timestamptz 문자열. 기간 끝은 이 값 미만(lt)으로 거른다 */
function kstNextDayStart(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, day + 1))
  return `${next.toISOString().slice(0, 10)}T00:00:00+09:00`
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type ArPassRecord = {
  id: string
  points: number
  words: number | null
  created_at: string | null
}

type BookArInfo = { title: string; barcode: string; ar_level: number | null; ar_points: number | null; word_count: number | null }

function readBookAr(b: unknown): BookArInfo {
  const x = (b ?? {}) as Partial<Record<keyof BookArInfo, unknown>>
  return {
    title: typeof x.title === 'string' ? x.title : '',
    barcode: typeof x.barcode === 'string' ? x.barcode : '',
    ar_level: toNum(x.ar_level as number | null),
    ar_points: toNum(x.ar_points as number | null),
    word_count: toNum(x.word_count as number | null),
  }
}

type ArPassResult = ActionResult<{ record: ArPassRecord; already: boolean; noPoints: boolean }>

/** 학생 확인: 회원(resident)이면서 비회원(is_guest) 아님 */
async function isStudent(userId: string): Promise<boolean> {
  const { data: student } = await supabaseAdmin.from('profiles').select('id, role, is_guest').eq('id', userId).maybeSingle()
  return !!student && student.role === 'resident' && !student.is_guest
}

/**
 * ar_results 한 건 넣기 (recordArPass·recordArPassForBook 공용).
 * - 같은 학생·같은 책은 1번만: 이미 있으면 새로 만들지 않고 기존 기록을 돌려준다(already: true).
 * - 포인트·단어 수는 지금 책의 ar_points·word_count 를 복사해 둔다(나중에 책 정보가 바뀌어도 기록은 그대로).
 */
async function insertArPass(params: {
  userId: string
  book: { id: string; ar_points: number | string | null; word_count: number | string | null }
  rentalId: string | null
  recordedBy: string
}): Promise<ArPassResult> {
  const { userId, book, rentalId, recordedBy } = params
  const findExisting = async () => {
    const { data } = await supabaseAdmin
      .from('ar_results')
      .select('id, points, words, created_at')
      .eq('user_id', userId)
      .eq('book_id', book.id)
      .maybeSingle()
    return data
  }

  const existing = await findExisting()
  if (existing) {
    return { success: true, data: { record: { ...existing, points: Number(existing.points) || 0 }, already: true, noPoints: false } }
  }

  const points = toNum(book.ar_points)
  const { data: inserted, error } = await supabaseAdmin
    .from('ar_results')
    .insert({
      user_id: userId,
      book_id: book.id,
      rental_id: rentalId,
      passed: true,
      points: points === null ? 0 : round1(points),
      words: toNum(book.word_count),
      recorded_by: recordedBy,
    })
    .select('id, points, words, created_at')
    .single()

  if (error || !inserted) {
    // 동시에 두 번 눌러 유니크 인덱스(user_id, book_id)에 걸린 경우 = 이미 기록됨
    if (error?.code === '23505') {
      const again = await findExisting()
      if (again) return { success: true, data: { record: { ...again, points: Number(again.points) || 0 }, already: true, noPoints: false } }
    }
    return { success: false, error: 'AR 통과 기록에 실패했습니다.' }
  }
  return { success: true, data: { record: { ...inserted, points: Number(inserted.points) || 0 }, already: false, noPoints: points === null } }
}

/**
 * AR 퀴즈 통과 기록. 선생님이 체크한다(젤리와 연결 안 함).
 * rentalId 의 학생·책으로 기록한다 (반납 화면·반별 현황·학생 상세). 반납된 대출만 된다.
 */
export async function recordArPass(rentalId: string): Promise<ArPassResult> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (typeof rentalId !== 'string' || !rentalId) return { success: false, error: '대출 기록이 올바르지 않습니다.' }
  const { data: rental } = await supabaseAdmin
    .from('rentals')
    .select('id, user_id, book_id, returned_at')
    .eq('id', rentalId)
    .maybeSingle()
  if (!rental) return { success: false, error: '대출 기록을 찾을 수 없습니다.' }
  if (!rental.returned_at) return { success: false, error: '아직 반납하지 않은 대출입니다. 반납한 뒤 기록해 주세요.' }

  if (!(await isStudent(rental.user_id))) return { success: false, error: '학생 회원의 대출만 기록할 수 있습니다.' }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, ar_points, word_count')
    .eq('id', rental.book_id)
    .maybeSingle()
  if (!book) return { success: false, error: '책을 찾을 수 없습니다.' }

  return insertArPass({ userId: rental.user_id, book, rentalId: rental.id, recordedBy: auth.userId })
}

/**
 * 대출 기록 없이 AR 통과 기록 (학원 밖에서 읽은 책 등). rental_id 는 비운다.
 * 그 학생이 지금 빌려 가 있는 책이면 반납한 뒤 기록하게 한다(recordArPass 와 같은 기준).
 */
export async function recordArPassForBook(userId: string, bookId: string): Promise<ArPassResult> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (typeof userId !== 'string' || !userId) return { success: false, error: '학생이 올바르지 않습니다.' }
  if (typeof bookId !== 'string' || !bookId) return { success: false, error: '책이 올바르지 않습니다.' }
  if (!(await isStudent(userId))) return { success: false, error: '학생 회원만 기록할 수 있습니다.' }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, ar_points, word_count')
    .eq('id', bookId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!book) return { success: false, error: '책을 찾을 수 없습니다.' }

  const { data: active } = await supabaseAdmin
    .from('rentals')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', book.id)
    .is('returned_at', null)
    .limit(1)
  if (active && active.length > 0) return { success: false, error: '지금 빌려 간 책입니다. 반납한 뒤 기록해 주세요.' }

  return insertArPass({ userId, book, rentalId: null, recordedBy: auth.userId })
}

/** AR 통과 기록 취소(삭제) */
export async function cancelArPass(resultId: string): Promise<ActionResult> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (typeof resultId !== 'string' || !resultId) return { success: false, error: '기록이 올바르지 않습니다.' }
  const { error, count } = await supabaseAdmin.from('ar_results').delete({ count: 'exact' }).eq('id', resultId)
  if (error) return { success: false, error: '취소에 실패했습니다.' }
  if ((count ?? 0) === 0) return { success: false, error: '이미 취소된 기록입니다.' }
  return { success: true }
}

export type ArReturnItem = {
  rental_id: string
  book_id: string
  title: string
  ar_level: number | null
  ar_points: number | null
  returned_at: string
  /** 통과 기록 (없으면 null) */
  result: ArPassRecord | null
}

/** 기존 통과 기록: (user_id, book_id) → 기록 */
async function fetchArResultMap(userIds: string[], bookIds?: string[]): Promise<Map<string, ArPassRecord>> {
  const map = new Map<string, ArPassRecord>()
  for (const ids of chunk(userIds, 100)) {
    for (let from = 0; ; from += PAGE) {
      let q = supabaseAdmin
        .from('ar_results')
        .select('id, user_id, book_id, points, words, created_at')
        .in('user_id', ids)
      if (bookIds) q = q.in('book_id', bookIds)
      const { data } = await q.order('id').range(from, from + PAGE - 1)
      for (const r of data ?? []) {
        if (r.book_id) map.set(`${r.user_id}:${r.book_id}`, { id: r.id, points: Number(r.points) || 0, words: r.words, created_at: r.created_at })
      }
      if (!data || data.length < PAGE) break
    }
  }
  return map
}

/**
 * 반별 현황용: 학생들의 최근 반납한 책(기본 30일, 학생마다 최신 5권)과 AR 통과 여부.
 * 반환: user_id → 목록
 */
export async function getRecentReturnsForAr(
  userIds: string[],
  days = 30
): Promise<ActionResult<{ byUser: Record<string, ArReturnItem[]> }>> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const ids = [...new Set((userIds ?? []).filter((x) => typeof x === 'string' && x))]
  if (ids.length === 0) return { success: true, data: { byUser: {} } }
  if (ids.length > MAX_IMPORT_ROWS) return { success: false, error: `한 번에 ${MAX_IMPORT_ROWS}명까지 볼 수 있습니다.` }
  const span = Number.isInteger(days) && days > 0 && days <= 365 ? days : 30
  const since = new Date(Date.now() - span * 24 * 60 * 60 * 1000).toISOString()

  try {
    const rows: { id: string; user_id: string; book_id: string; returned_at: string; book: unknown }[] = []
    for (const part of chunk(ids, 200)) {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
          .from('rentals')
          .select('id, user_id, book_id, returned_at, book:books(title, barcode, ar_level, ar_points, word_count)')
          .in('user_id', part)
          .not('returned_at', 'is', null)
          .gte('returned_at', since)
          .order('returned_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        for (const r of data ?? []) if (r.returned_at) rows.push({ ...r, returned_at: r.returned_at })
        if (!data || data.length < PAGE) break
      }
    }

    const byUser: Record<string, ArReturnItem[]> = {}
    const seen = new Set<string>() // 같은 책을 여러 번 빌렸으면 최근 1번만
    for (const r of rows.sort((a, b) => b.returned_at.localeCompare(a.returned_at))) {
      const key = `${r.user_id}:${r.book_id}`
      if (seen.has(key)) continue
      const list = (byUser[r.user_id] ??= [])
      if (list.length >= 5) continue
      seen.add(key)
      const b = readBookAr(r.book)
      list.push({ rental_id: r.id, book_id: r.book_id, title: b.title, ar_level: b.ar_level, ar_points: b.ar_points, returned_at: r.returned_at, result: null })
    }

    const bookIds = [...new Set(Object.values(byUser).flatMap((l) => l.map((x) => x.book_id)))]
    if (bookIds.length > 0) {
      // 책 id 까지 URL 에 넣으면 길어지므로 학생 기준으로만 읽는다 (학생 1명의 통과 기록은 많아야 수백 건)
      const results = await fetchArResultMap(Object.keys(byUser))
      for (const [userId, list] of Object.entries(byUser)) {
        for (const item of list) item.result = results.get(`${userId}:${item.book_id}`) ?? null
      }
    }
    return { success: true, data: { byUser } }
  } catch {
    return { success: false, error: '최근 반납한 책을 불러오지 못했습니다.' }
  }
}

export type ArReturnTarget = {
  rental_id: string
  user_name: string
  title: string
  ar_level: number | null
  ar_points: number | null
  word_count: number | null
  result: ArPassRecord | null
}

/** 반납 화면용: 방금 반납한 책(바코드)의 가장 최근 반납 기록과 AR 통과 여부. 학생 대출이 아니면 null */
export async function getReturnedRentalForAr(barcode: string): Promise<ActionResult<ArReturnTarget | null>> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const code = typeof barcode === 'string' ? barcode.trim() : ''
  if (!code) return { success: true, data: null }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, title, ar_level, ar_points, word_count')
    .eq('barcode', code)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!book) return { success: true, data: null }

  const { data: rental } = await supabaseAdmin
    .from('rentals')
    .select('id, user_id')
    .eq('book_id', book.id)
    .not('returned_at', 'is', null)
    .order('returned_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!rental) return { success: true, data: null }

  const { data: student } = await supabaseAdmin.from('profiles').select('name, role, is_guest').eq('id', rental.user_id).maybeSingle()
  if (!student || student.role !== 'resident' || student.is_guest) return { success: true, data: null }

  const results = await fetchArResultMap([rental.user_id], [book.id])
  return {
    success: true,
    data: {
      rental_id: rental.id,
      user_name: student.name,
      title: book.title,
      ar_level: toNum(book.ar_level),
      ar_points: toNum(book.ar_points),
      word_count: toNum(book.word_count),
      result: results.get(`${rental.user_id}:${book.id}`) ?? null,
    },
  }
}

export type ArPassedBook = ArPassRecord & {
  book_id: string | null
  title: string
  ar_level: number | null
  /** 체크한 선생님 이름 (recorded_by → profiles.name). 모르면 null */
  recorded_by_name: string | null
}

export type ArStudentSummary = {
  passedCount: number
  totalPoints: number
  totalWords: number
  items: ArPassedBook[]
}

async function buildArSummary(userId: string): Promise<ArStudentSummary> {
  const items: ArPassedBook[] = []
  const recorders = new Map<string, string>() // 기록 id → recorded_by
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('ar_results')
      .select('id, book_id, points, words, created_at, passed, recorded_by, book:books(title, ar_level)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      if (r.passed === false) continue
      const b = (r.book ?? {}) as { title?: string; ar_level?: number | null }
      items.push({
        id: r.id,
        book_id: r.book_id,
        points: Number(r.points) || 0,
        words: r.words,
        created_at: r.created_at,
        title: b.title ?? '(삭제된 책)',
        ar_level: toNum(b.ar_level ?? null),
        recorded_by_name: null,
      })
      if (r.recorded_by) recorders.set(r.id, r.recorded_by)
    }
    if (!data || data.length < PAGE) break
  }
  // 체크한 선생님 이름 (선생님은 몇 명뿐이라 한 번에 읽는다)
  const recorderIds = [...new Set(recorders.values())]
  if (recorderIds.length > 0) {
    const names = new Map<string, string>()
    for (const ids of chunk(recorderIds, 100)) {
      const { data } = await supabaseAdmin.from('profiles').select('id, name').in('id', ids)
      for (const p of data ?? []) names.set(p.id, p.name)
    }
    for (const it of items) {
      const by = recorders.get(it.id)
      it.recorded_by_name = by ? names.get(by) ?? null : null
    }
  }
  return {
    passedCount: items.length,
    totalPoints: round1(items.reduce((s, x) => s + x.points, 0)),
    totalWords: items.reduce((s, x) => s + (x.words ?? 0), 0),
    items,
  }
}

/** 회원 상세 학원 정보 카드: 통과 권수·누적 포인트·단어 수와 통과 목록 */
export async function getStudentArSummary(userId: string): Promise<ActionResult<ArStudentSummary>> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (typeof userId !== 'string' || !userId) return { success: false, error: '학생이 올바르지 않습니다.' }
  try {
    return { success: true, data: await buildArSummary(userId) }
  } catch {
    return { success: false, error: 'AR 통과 기록을 불러오지 못했습니다.' }
  }
}

export type ArPassCandidateRental = {
  rental_id: string
  book_id: string
  title: string
  barcode: string
  ar_level: number | null
  ar_points: number | null
  returned_at: string
  result: ArPassRecord | null
}

export type ArPassCandidateBook = {
  book_id: string
  title: string
  barcode: string
  ar_level: number | null
  ar_points: number | null
  result: ArPassRecord | null
}

/**
 * 학생 상세 "책 찾아서 통과 기록": 제목/바코드로 찾는다.
 * - rentals: 그 학생이 빌렸다 반납한 책(같은 책은 최근 1번). 검색어가 비면 최근 반납 20권.
 * - books: 대출 기록이 없는 책(학원 밖에서 읽은 책 등) 중 검색어에 맞는 책 최대 20권. 검색어가 비면 빈 목록.
 */
export async function searchArPassCandidates(
  userId: string,
  query: string
): Promise<ActionResult<{ rentals: ArPassCandidateRental[]; books: ArPassCandidateBook[] }>> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (typeof userId !== 'string' || !userId) return { success: false, error: '학생이 올바르지 않습니다.' }
  if (!(await isStudent(userId))) return { success: false, error: '학생 회원만 기록할 수 있습니다.' }

  const q = typeof query === 'string' ? query.trim().slice(0, 100) : ''
  const qLower = q.toLowerCase()
  const LIMIT = 20

  try {
    // 1) 그 학생의 반납된 대출 전체(학생 1명이라 많아야 수백~수천 건) → 검색어로 거르기
    const seen = new Set<string>()
    const rentals: ArPassCandidateRental[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('rentals')
        .select('id, book_id, returned_at, book:books(title, barcode, ar_level, ar_points, is_deleted)')
        .eq('user_id', userId)
        .not('returned_at', 'is', null)
        .order('returned_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      for (const r of data ?? []) {
        if (!r.returned_at || seen.has(r.book_id)) continue
        const raw = (r.book ?? {}) as { is_deleted?: boolean }
        const b = readBookAr(r.book)
        if (raw.is_deleted) continue
        if (q && !b.title.toLowerCase().includes(qLower) && b.barcode !== q) continue
        seen.add(r.book_id)
        rentals.push({ rental_id: r.id, book_id: r.book_id, title: b.title, barcode: b.barcode, ar_level: b.ar_level, ar_points: b.ar_points, returned_at: r.returned_at, result: null })
      }
      if (!data || data.length < PAGE) break
    }
    const rentalList = rentals.slice(0, q ? 50 : LIMIT)

    // 2) 대출 기록 없는 책 (검색어가 있을 때만)
    const books: ArPassCandidateBook[] = []
    if (q) {
      const sel = 'id, title, barcode, ar_level, ar_points'
      const [byCode, byTitle] = await Promise.all([
        supabaseAdmin.from('books').select(sel).eq('is_deleted', false).eq('barcode', q).limit(5),
        supabaseAdmin.from('books').select(sel).eq('is_deleted', false).ilike('title', `%${escapeLike(q)}%`).order('title').limit(LIMIT + 10),
      ])
      if (byCode.error || byTitle.error) throw new Error('books')
      // 지금 빌려 가 있는 책은 반납 후에 기록하므로 뺀다
      const { data: active } = await supabaseAdmin.from('rentals').select('book_id').eq('user_id', userId).is('returned_at', null)
      const activeIds = new Set((active ?? []).map((r) => r.book_id))
      for (const b of [...(byCode.data ?? []), ...(byTitle.data ?? [])]) {
        if (books.length >= LIMIT) break
        if (seen.has(b.id) || activeIds.has(b.id) || books.some((x) => x.book_id === b.id)) continue
        books.push({ book_id: b.id, title: b.title, barcode: b.barcode, ar_level: toNum(b.ar_level), ar_points: toNum(b.ar_points), result: null })
      }
    }

    // 3) 이미 통과 기록이 있는지
    if (rentalList.length + books.length > 0) {
      const results = await fetchArResultMap([userId])
      for (const r of rentalList) r.result = results.get(`${userId}:${r.book_id}`) ?? null
      for (const b of books) b.result = results.get(`${userId}:${b.book_id}`) ?? null
    }
    return { success: true, data: { rentals: rentalList, books } }
  } catch {
    return { success: false, error: '책을 찾지 못했습니다.' }
  }
}

export type ArRankItem = {
  user_id: string
  name: string
  group: string
  points: number
  passed: number
  words: number
}

/**
 * AR 포인트 랭킹: 기간(KST 날짜, 통과 기록한 날 기준) 포인트 합·통과 권수. group 을 주면 그 반만.
 * 반 목록(classes)도 함께 돌려준다(반 필터용).
 */
export async function getArPointRanking(params: { startDate: string; endDate: string; group?: string; limit?: number }): Promise<
  ActionResult<{ items: ArRankItem[]; classes: string[] }>
> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const { startDate, endDate } = params ?? ({} as { startDate: string; endDate: string })
  if (!DATE_RE.test(startDate ?? '') || !DATE_RE.test(endDate ?? '')) return { success: false, error: '기간을 확인해 주세요.' }
  const limit = Number.isInteger(params.limit) && (params.limit as number) > 0 ? Math.min(params.limit as number, 500) : 100
  const group = typeof params.group === 'string' ? params.group : undefined

  try {
    const totals = new Map<string, { points: number; passed: number; words: number }>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('ar_results')
        .select('user_id, points, words')
        .eq('passed', true)
        .gte('created_at', kstDayStart(startDate))
        .lt('created_at', kstNextDayStart(endDate))
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      for (const r of data ?? []) {
        const t = totals.get(r.user_id) ?? { points: 0, passed: 0, words: 0 }
        t.points += Number(r.points) || 0
        t.passed += 1
        t.words += r.words ?? 0
        totals.set(r.user_id, t)
      }
      if (!data || data.length < PAGE) break
    }

    const [groups, residents, memberInfo] = await Promise.all([
      readMemberGroups(),
      fetchResidents(),
      totals.size > 0 ? fetchMemberInfo([...totals.keys()]) : Promise.resolve(new Map<string, MemberInfo>()),
    ])
    const profileMap = new Map(residents.map((r) => [r.id, r]))
    const classes = [...groups]
    const collator = new Intl.Collator('ko', { numeric: true })
    const extra = [...new Set(residents.map((r) => r.dong_ho).filter((g) => g && !groups.includes(g)))].sort(collator.compare)
    classes.push(...extra)

    const items: ArRankItem[] = []
    for (const [userId, t] of totals) {
      const p = profileMap.get(userId)
      if (!p) continue // 회원(학생)이 아닌 기록은 랭킹에서 뺀다
      if (memberInfo.get(userId)?.status === 'inactive') continue // 퇴원생은 랭킹에서 뺀다
      if (group !== undefined && p.dong_ho !== group) continue
      items.push({ user_id: userId, name: p.name, group: p.dong_ho, points: round1(t.points), passed: t.passed, words: t.words })
    }
    items.sort((a, b) => b.points - a.points || b.passed - a.passed || collator.compare(a.name, b.name))
    return { success: true, data: { items: items.slice(0, limit), classes } }
  } catch {
    return { success: false, error: 'AR 포인트 랭킹을 불러오지 못했습니다.' }
  }
}

export type LevelLabelBook = {
  id: string
  title: string
  barcode: string
  ar_level: number
  location_group: string
}

/** 레벨 라벨 인쇄용 책 목록: AR 레벨이 있는 책만. 책장(location_group)·레벨 범위로 고른다. 최대 2000권 */
export async function getBooksForLevelLabels(params: { shelf?: string; min?: number; max?: number }): Promise<
  ActionResult<{ books: LevelLabelBook[]; truncated: boolean }>
> {
  const auth = await requireAcademyArAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const MAX = 2000
  const shelf = typeof params?.shelf === 'string' && params.shelf.trim() ? params.shelf.trim() : undefined
  const min = typeof params?.min === 'number' && Number.isFinite(params.min) ? params.min : undefined
  const max = typeof params?.max === 'number' && Number.isFinite(params.max) ? params.max : undefined
  if (min !== undefined && max !== undefined && min > max) return { success: false, error: '레벨 범위를 확인해 주세요.' }

  const books: LevelLabelBook[] = []
  for (let from = 0; from < MAX + 1; from += PAGE) {
    let q = supabaseAdmin
      .from('books')
      .select('id, title, barcode, ar_level, location_group, location_detail')
      .eq('is_deleted', false)
      .not('ar_level', 'is', null)
    if (shelf) q = q.eq('location_group', shelf)
    if (min !== undefined) q = q.gte('ar_level', min)
    if (max !== undefined) q = q.lte('ar_level', max)
    const { data, error } = await q
      .order('ar_level', { ascending: true })
      .order('title', { ascending: true })
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return { success: false, error: '책 목록을 불러오지 못했습니다.' }
    for (const b of data ?? []) {
      const level = toNum(b.ar_level)
      if (level === null) continue
      books.push({ id: b.id, title: b.title, barcode: b.barcode, ar_level: level, location_group: b.location_group })
    }
    if (!data || data.length < PAGE) break
  }
  const truncated = books.length > MAX
  return { success: true, data: { books: books.slice(0, MAX), truncated } }
}

export type MyArReading = {
  grade: number | null
  zpd_low: number | null
  zpd_high: number | null
  passedCount: number
  totalPoints: number
  totalWords: number
}

/**
 * 학생 본인용(마이페이지 카드·도서 목록 "내 레벨 책" 칩): 로그인한 본인 것만 읽는다.
 * 학원 모드 + ar_enabled 가 아니거나, 로그인 안 했거나, 학원 정보·통과 기록이 하나도 없으면 null (에러 아님).
 */
export async function getMyArReading(): Promise<MyArReading | null> {
  try {
    const { data: settings } = await supabaseAdmin
      .from('library_settings')
      .select('key, value')
      .in('key', ['site_type', 'ar_enabled'])
    const s: Record<string, string> = {}
    for (const row of settings ?? []) s[row.key] = row.value
    if (!isAcademy(s.site_type) || !isFlagOn(s, 'ar_enabled')) return null

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: member }, { data: results }] = await Promise.all([
      supabaseAdmin.from('academy_members').select('grade, zpd_low, zpd_high').eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('ar_results').select('points, words').eq('user_id', user.id).eq('passed', true).limit(5000),
    ])
    const list = results ?? []
    if (!member && list.length === 0) return null
    return {
      grade: member?.grade ?? null,
      zpd_low: toNum(member?.zpd_low ?? null),
      zpd_high: toNum(member?.zpd_high ?? null),
      passedCount: list.length,
      totalPoints: round1(list.reduce((sum, r) => sum + (Number(r.points) || 0), 0)),
      totalWords: list.reduce((sum, r) => sum + (r.words ?? 0), 0),
    }
  } catch {
    return null
  }
}
