import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'

// 커플 데이터 전체를 JSON 파일로 내려받는다 (무료 플랜은 자동 백업이 없으므로).
// RLS 덕분에 내 커플 데이터만 조회된다. 상대의 비공개 일정 내용(event_secrets)은 포함되지 않는다.
export async function downloadBackup() {
  const [couples, profiles, events, comments, reactions, anniversaries, wishes] = await Promise.all([
    supabase.from('couples').select('*'),
    supabase.from('profiles').select('*'),
    supabase.from('events').select('*, event_secrets(*)').order('created_at'),
    supabase.from('event_comments').select('*').order('created_at'),
    supabase.from('event_reactions').select('*'),
    supabase.from('anniversaries').select('*').order('base_date'),
    supabase.from('wishes').select('*').order('created_at'),
  ])
  for (const r of [couples, profiles, events, comments, reactions, anniversaries, wishes]) {
    if (r.error) throw r.error
  }

  const backup = {
    app: '러브로그',
    format: 1,
    exported_at: new Date().toISOString(),
    couples: couples.data,
    profiles: profiles.data,
    events: events.data,
    event_comments: comments.data,
    event_reactions: reactions.data,
    anniversaries: anniversaries.data,
    wishes: wishes.data,
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ourcal-backup-${format(new Date(), 'yyyyMMdd')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 일부 브라우저는 클릭 직후 해제하면 다운로드가 끊긴다
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  return {
    events: events.data?.length ?? 0,
    anniversaries: anniversaries.data?.length ?? 0,
    wishes: wishes.data?.length ?? 0,
  }
}
