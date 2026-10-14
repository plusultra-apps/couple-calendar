// service role 클라이언트 (RLS 우회) · 서버 설정값(app_config)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

let configCache: Record<string, string> | null = null

export async function getConfig(): Promise<Record<string, string>> {
  if (configCache) return configCache
  const { data, error } = await admin.from('app_config').select('key, value')
  if (error) throw error
  configCache = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  return configCache
}

// Bearer 토큰(사용자 JWT) → 사용자 id. 실패하면 null
export async function userIdFromToken(token: string): Promise<string | null> {
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error || !data.user ? null : data.user.id
}
