'use server'

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

const BUCKET = 'admin-files'
const MAX_SIZE = 50 * 1024 * 1024 // 버킷 제한과 같게 50MB
// 인쇄·문서용 파일만 (pdf, 한글, 워드, 엑셀, 파워포인트, 이미지, 텍스트)
const ALLOWED_EXT = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'txt']

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || user.admin_status !== 'approved') return null
  return user
}

function extOf(name: string) {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
}

export async function getAdminFiles() {
  if (!(await requireAdmin())) return []
  const { data } = await supabaseAdmin
    .from('admin_files')
    .select('id, name, size, mime, memo, created_at, uploader:profiles(name)')
    .order('created_at', { ascending: false })
  return (data ?? []).map((f) => ({ ...f, uploader: (f.uploader as { name: string } | null)?.name ?? null }))
}

// 1단계: 업로드용 일회성 주소 발급 (브라우저가 저장소로 바로 올림 → 서버 요청 크기 제한을 피함)
// 저장 경로는 한글 파일명 대신 월/uuid.확장자
export async function createAdminFileUpload(
  fileName: string,
  size: number
): Promise<ActionResult<{ path: string; token: string }>> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  const ext = extOf(fileName)
  if (!ALLOWED_EXT.includes(ext)) {
    return { success: false, error: `올릴 수 없는 파일 형식이에요 (.${ext || '없음'}). PDF·한글·워드·엑셀·이미지 파일만 올릴 수 있어요.` }
  }
  if (size > MAX_SIZE) return { success: false, error: '50MB 이하 파일만 올릴 수 있어요.' }

  const month = new Date().toISOString().slice(0, 7)
  const path = `${month}/${randomUUID()}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false, error: '업로드 준비에 실패했습니다.' }
  return { success: true, data: { path: data.path, token: data.token } }
}

// 2단계: 업로드가 끝난 파일을 목록에 등록
export async function saveAdminFile(input: {
  path: string
  name: string
  size: number
  mime: string
  memo: string
}): Promise<ActionResult> {
  const user = await requireAdmin()
  if (!user) return { success: false, error: '권한이 없습니다.' }

  const { error } = await supabaseAdmin.from('admin_files').insert({
    path: input.path,
    name: input.name.slice(0, 255),
    size: input.size,
    mime: input.mime || null,
    memo: input.memo.trim() || null,
    uploaded_by: user.id,
  })
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([input.path])
    return { success: false, error: '파일 등록에 실패했습니다.' }
  }
  return { success: true }
}

// 내려받기: 5분짜리 임시 주소, 원래 파일 이름으로 저장되게
export async function getAdminFileDownloadUrl(id: string): Promise<ActionResult<{ url: string }>> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  const { data: file } = await supabaseAdmin.from('admin_files').select('path, name').eq('id', id).single()
  if (!file) return { success: false, error: '파일을 찾을 수 없어요.' }
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(file.path, 300, { download: file.name })
  if (error || !data) return { success: false, error: '내려받기 주소를 만들지 못했어요.' }
  return { success: true, data: { url: data.signedUrl } }
}

export async function updateAdminFileMemo(id: string, memo: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  const { error } = await supabaseAdmin.from('admin_files').update({ memo: memo.trim() || null }).eq('id', id)
  if (error) return { success: false, error: '메모 저장에 실패했습니다.' }
  return { success: true }
}

export async function deleteAdminFile(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  const { data: file } = await supabaseAdmin.from('admin_files').select('path').eq('id', id).single()
  if (!file) return { success: false, error: '파일을 찾을 수 없어요.' }
  await supabaseAdmin.storage.from(BUCKET).remove([file.path])
  const { error } = await supabaseAdmin.from('admin_files').delete().eq('id', id)
  if (error) return { success: false, error: '삭제에 실패했습니다.' }
  return { success: true }
}
