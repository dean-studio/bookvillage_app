import { createClient } from '@/lib/supabase/client'

export async function uploadMarketImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${ext}`
  const filePath = `market/${fileName}`

  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false })

  if (error) return null

  const { data } = supabase.storage.from('images').getPublicUrl(filePath)
  return data.publicUrl
}
