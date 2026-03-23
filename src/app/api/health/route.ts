import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {
    env: 'error',
    supabase: 'error',
  }

  // Check required env vars
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  const missingVars = requiredEnvVars.filter((v) => !process.env[v])
  checks.env = missingVars.length === 0 ? 'ok' : 'error'

  // Check Supabase connectivity
  if (checks.env === 'ok') {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error } = await supabase.from('profiles').select('id').limit(1)
      checks.supabase = error ? 'error' : 'ok'
    } catch {
      checks.supabase = 'error'
    }
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'unhealthy', checks },
    { status: allOk ? 200 : 503 }
  )
}
