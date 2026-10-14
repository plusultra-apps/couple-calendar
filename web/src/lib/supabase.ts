import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('web/.env.local 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 없습니다')
}

export const supabase = createClient<Database>(url, key)

// RPC 에서 raise 한 코드를 사용자에게 보여줄 문장으로 바꾼다
const MESSAGES: Record<string, string> = {
  'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요',
  'User already registered': '이미 가입된 이메일이에요',
  'Email not confirmed': '메일함에서 가입 확인 링크를 먼저 눌러 주세요',
  already_in_couple: '이미 커플로 연결되어 있어요',
  invalid_code: '초대 코드를 다시 확인해 주세요',
  couple_full: '이미 두 사람이 연결된 코드예요',
  title_required: '제목을 입력해 주세요',
  event_not_found: '일정을 찾을 수 없어요. 이미 삭제되었을 수 있어요',
  'row-level security': '이 작업을 할 권한이 없어요',
  'permission denied': '이 작업을 할 권한이 없어요',
  'Failed to fetch': '인터넷 연결을 확인해 주세요',
}

export function toMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  const hit = Object.keys(MESSAGES).find((k) => raw.includes(k))
  if (hit) return MESSAGES[hit]
  if (raw.includes('Password should be')) return '비밀번호는 6자 이상이어야 해요'
  return raw
}
