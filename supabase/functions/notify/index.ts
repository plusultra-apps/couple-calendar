// 푸시 알림 발송 (PLAN.md 6장)
// (a) DB 트리거(private.notify_webhook) → x-webhook-secret 인증 → 행위자의 상대에게 발송
// (b) 앱의 "테스트 알림" → 사용자 JWT 인증 → 본인 기기로 발송
// (c) 배포 스크립트(scripts/deploy.mjs --notes) → x-release-secret 인증 → 모든 사용자에게 업데이트 소식
// verify_jwt = false (인증은 함수 안에서 직접 한다)
// 받는 사람마다 알림함에 남기고, 그 사람 설정(종류별 끄기 · 조용한 시간)에 따라 푸시한다 (_shared/push.ts deliver)
import { admin, getConfig, userIdFromToken } from '../_shared/admin.ts'
import { bearer, corsHeaders, json, safeEqual } from '../_shared/http.ts'
import { deliver, sendToUsers, type Kind, type Message } from '../_shared/push.ts'
import { fmtDateTime, fmtDayKey } from '../_shared/seoul.ts'

type Row = Record<string, unknown>
type WebhookPayload = {
  table: string
  op: 'INSERT' | 'UPDATE' | 'DELETE'
  record: Row | null
  old_record: Row | null
  actor: string | null
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

// 테이블 → 알림 종류 (설정의 종류별 끄기와 같은 이름)
const KIND: Record<string, Kind> = {
  events: 'event',
  event_comments: 'comment',
  event_reactions: 'comment',
  wishes: 'wish',
  anniversaries: 'anniv',
  photos: 'photo',
  photo_likes: 'like',
  poker_games: 'game',
}

// 일정 시간 표시: 종일 '10월 5일 (일)' / 여러 날 '… ~ …' / 시간 '10월 5일 (일) 오후 7:00'
function whenOf(e: Row): string {
  if (e.all_day) {
    const s = e.start_date as string
    const t = e.end_date as string
    return s === t ? fmtDayKey(s) : `${fmtDayKey(s)} ~ ${fmtDayKey(t)}`
  }
  return fmtDateTime(e.starts_at as string)
}

// 알림에 쓸 일정 제목. 비공개 일정은 소유자에게만 실제 제목, 그 외엔 '바쁨'
async function eventTitleFor(eventId: string, recipient: string): Promise<string> {
  const { data: e } = await admin
    .from('events')
    .select('title, is_private, owner_id, event_secrets(title)')
    .eq('id', eventId)
    .maybeSingle()
  if (!e) return '일정'
  if (!e.is_private) return e.title
  const secret = e.event_secrets as unknown as { title: string } | null
  return e.owner_id === recipient && secret ? secret.title : '바쁨'
}

const VERB = { INSERT: '추가했어요', UPDATE: '수정했어요', DELETE: '삭제했어요' } as const

async function buildMessage(p: WebhookPayload, nick: string, recipient: string): Promise<Message | null> {
  const r = (p.record ?? p.old_record)!
  switch (p.table) {
    case 'events': {
      const id = r.id as string
      const url = p.op === 'DELETE' ? '/' : `/event/${id}`
      // 비공개 일정은 제목·장소를 절대 싣지 않는다 (날짜만)
      if (r.is_private) {
        return { title: `🔒 ${nick}님이 비공개 일정을 ${VERB[p.op]}`, body: whenOf(r), tag: `event-${id}`, url }
      }
      return { title: `💕 ${nick}님이 일정을 ${VERB[p.op]}`, body: `${r.title} · ${whenOf(r)}`, tag: `event-${id}`, url }
    }
    case 'event_comments': {
      const eventId = r.event_id as string
      const title = await eventTitleFor(eventId, recipient)
      return { title: `💬 ${title}`, body: `${nick}: ${r.body}`, tag: `comment-${eventId}`, url: `/event/${eventId}` }
    }
    case 'event_reactions': {
      const eventId = r.event_id as string
      const title = await eventTitleFor(eventId, recipient)
      return {
        title: `${nick}님이 ${r.emoji} 반응을 남겼어요`,
        body: title,
        tag: `reaction-${eventId}`,
        url: `/event/${eventId}`,
      }
    }
    case 'wishes': {
      if (p.op === 'UPDATE') {
        return { title: `🎊 ${nick}님이 위시를 이뤘어요`, body: `${r.title} · #${r.tag}`, tag: `wish-${r.id}`, url: '/wish' }
      }
      // 연달아 담은 개수: 이 위시부터 2분 안에 같은 사람이 담은 것 (트리거는 첫 번째에만 온다)
      const from = new Date(r.created_at as string)
      const { data: batch } = await admin
        .from('wishes')
        .select('title')
        .eq('created_by', p.actor!)
        .gte('created_at', from.toISOString())
        .lte('created_at', new Date(from.getTime() + 2 * 60_000).toISOString())
        .order('created_at')
      const titles = (batch ?? []).map((w) => w.title as string)
      if (titles.length > 1) {
        const more = titles.length > 3 ? ` 외 ${titles.length - 3}개` : ''
        return {
          title: `✨ ${nick}님이 위시 ${titles.length}개를 담았어요`,
          body: titles.slice(0, 3).join(' · ') + more,
          tag: `wish-batch-${r.id}`,
          url: '/wish',
        }
      }
      return { title: `✨ 위시리스트에 추가: ${r.title}`, body: `${nick}님이 담았어요 · #${r.tag}`, tag: `wish-${r.id}`, url: '/wish' }
    }
    case 'photos': {
      // 연달아 올린 장수: 이 사진부터 2분 안에 같은 사람이 올린 사진 (트리거는 첫 장에만 온다)
      const from = new Date(r.created_at as string)
      const { count } = await admin
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', p.actor!)
        .gte('created_at', from.toISOString())
        .lte('created_at', new Date(from.getTime() + 2 * 60_000).toISOString())
      const n = Math.max(1, count ?? 1)
      const what = r.kind === 'fourcut' ? '인생네컷' : '사진'
      const day = r.taken_on as string
      const on = r.event_id ? `${await eventTitleFor(r.event_id as string, recipient)} · ${fmtDayKey(day)}` : fmtDayKey(day)
      return {
        title: `📸 ${nick}님이 ${what}${n > 1 ? ` ${n}장을` : '을'} 올렸어요`,
        body: on,
        tag: `photo-${day}`,
        url: `/?d=${day}`,
      }
    }
    case 'photo_likes': {
      const { data: photo } = await admin.from('photos').select('taken_on, event_id').eq('id', r.photo_id as string).maybeSingle()
      if (!photo) return null
      const on = photo.event_id
        ? `${await eventTitleFor(photo.event_id, recipient)} · ${fmtDayKey(photo.taken_on)}`
        : fmtDayKey(photo.taken_on)
      return { title: `❤️ ${nick}님이 사진에 하트를 눌렀어요`, body: on, tag: `like-${r.photo_id}`, url: '/memories' }
    }
    case 'anniversaries':
      return {
        title: `🎉 기념일 추가: ${r.title}`,
        body: `${nick}님 · ${fmtDayKey(r.base_date as string)}${r.is_lunar ? ' (음력)' : ''}`,
        tag: `anniv-${r.id}`,
        url: '/anniv',
      }
    case 'poker_games':
      // 새 게임 초대 (트리거는 insert 에만 온다). 카드·덱 정보는 싣지 않는다.
      return {
        title: `🃏 ${nick}님이 인디언 포커 한 판 하재요`,
        body: '눌러서 참가해요',
        tag: `poker-${r.id}`,
        url: '/poker',
      }
    default:
      return null
  }
}

async function handleWebhook(p: WebhookPayload) {
  if (!p.actor || !(p.record ?? p.old_record)) return
  const kind = KIND[p.table]
  if (!kind) return
  // 사진·위시는 여러 개를 하나씩 올리므로 잠깐 기다렸다가 몇 개인지 세서 한 번만 알린다
  if (p.table === 'photos' || (p.table === 'wishes' && p.op === 'INSERT')) await new Promise((r) => setTimeout(r, 20_000))
  const { data: me } = await admin.from('profiles').select('nickname, couple_id').eq('id', p.actor).maybeSingle()
  if (!me?.couple_id) return
  const { data: others } = await admin
    .from('profiles')
    .select('id')
    .eq('couple_id', me.couple_id)
    .neq('id', p.actor)
  for (const { id } of others ?? []) {
    const msg = await buildMessage(p, me.nickname || '상대', id)
    if (!msg) continue
    const result = await deliver(id, kind, msg)
    console.log(`notify ${p.table} ${p.op} → ${result}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    // (c) 배포 스크립트의 업데이트 소식 → x-release-secret 인증 → 커플이 있는 모든 사용자에게
    const release = req.headers.get('x-release-secret')
    if (release) {
      const c = await getConfig()
      if (!safeEqual(release, c.release_secret)) return json({ error: 'unauthorized' }, 401)
      const { notes } = (await req.json().catch(() => ({}))) as { notes?: string }
      const text = String(notes ?? '').trim().slice(0, 200)
      if (!text) return json({ error: 'bad_request' }, 400)
      const { data: people, error } = await admin.from('profiles').select('id').not('couple_id', 'is', null)
      if (error) throw error
      const msg: Message = { title: '🆕 러브로그가 업데이트됐어요', body: `${text} · 앱을 열면 새 버전으로 바뀌어요`, tag: 'app-update', url: '/' }
      const results = await Promise.all((people ?? []).map((p) => deliver(p.id, 'update', msg)))
      return json({ total: results.length, sent: results.filter((r) => r === 'sent').length })
    }

    const secret = req.headers.get('x-webhook-secret')
    if (secret) {
      const c = await getConfig()
      if (!safeEqual(secret, c.webhook_secret)) return json({ error: 'unauthorized' }, 401)
      const payload = (await req.json()) as WebhookPayload
      // DB(pg_net) 쪽은 결과를 기다릴 필요가 없으므로 바로 응답하고 뒤에서 발송한다
      EdgeRuntime.waitUntil(
        handleWebhook(payload).catch((e) => console.error('webhook 처리 실패', payload.table, payload.op, e)),
      )
      return json({ ok: true }, 202)
    }

    const userId = await userIdFromToken(bearer(req))
    if (!userId) return json({ error: 'unauthorized' }, 401)
    const body = await req.json().catch(() => ({}))
    if (body?.type !== 'test') return json({ error: 'bad_request' }, 400)
    const sent = await sendToUsers([userId], {
      title: '🔔 테스트 알림',
      body: '알림이 잘 도착했어요!',
      tag: 'test',
      url: '/settings',
    })
    return json({ sent })
  } catch (e) {
    console.error('notify 오류', e)
    return json({ error: (e as Error).message }, 500)
  }
})
