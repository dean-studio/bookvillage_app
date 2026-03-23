'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

export async function getLibrarySettings() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('library_settings')
    .select('key, value, description')

  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return settings
}

// 인증 불필요 - 로그인 페이지, OG 메타데이터 등에서 사용
export async function getPublicSettings() {
  const { data } = await supabaseAdmin
    .from('library_settings')
    .select('key, value')
    .in('key', ['apartment_name', 'logo_url', 'og_title', 'og_description', 'og_image_url'])

  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.value) settings[row.key] = row.value
  }
  return settings
}

export async function updateLibrarySetting(key: string, value: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.' }
  }

  const supabase = await createClient()

  // upsert로 변경 (키가 없을 수도 있음)
  const { error } = await supabase
    .from('library_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) {
    return { success: false, error: '설정 저장에 실패했습니다.' }
  }

  return { success: true }
}

export async function uploadLogo(formData: FormData): Promise<ActionResult & { url?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.' }
  }

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return { success: false, error: '파일을 선택해주세요.' }
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: '파일 크기는 2MB 이하여야 합니다.' }
  }

  const ext = file.name.split('.').pop() || 'png'
  const filePath = `logo/logo.${ext}`

  // 기존 로고 삭제 후 업로드
  await supabaseAdmin.storage.from('images').remove([filePath])

  const { error } = await supabaseAdmin.storage
    .from('images')
    .upload(filePath, file, { cacheControl: '3600', upsert: true })

  if (error) {
    return { success: false, error: '로고 업로드에 실패했습니다.' }
  }

  const { data } = supabaseAdmin.storage.from('images').getPublicUrl(filePath)
  const logoUrl = data.publicUrl

  // library_settings에 저장
  await supabaseAdmin
    .from('library_settings')
    .upsert({ key: 'logo_url', value: logoUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  return { success: true, url: logoUrl }
}

export async function uploadOgImage(formData: FormData): Promise<ActionResult & { url?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.' }
  }

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return { success: false, error: '파일을 선택해주세요.' }
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: '파일 크기는 2MB 이하여야 합니다.' }
  }

  const ext = file.name.split('.').pop() || 'png'
  const filePath = `og/og-image.${ext}`

  await supabaseAdmin.storage.from('images').remove([filePath])

  const { error } = await supabaseAdmin.storage
    .from('images')
    .upload(filePath, file, { cacheControl: '3600', upsert: true })

  if (error) {
    return { success: false, error: 'OG 이미지 업로드에 실패했습니다.' }
  }

  const { data } = supabaseAdmin.storage.from('images').getPublicUrl(filePath)
  const imageUrl = data.publicUrl

  await supabaseAdmin
    .from('library_settings')
    .upsert({ key: 'og_image_url', value: imageUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  return { success: true, url: imageUrl }
}
