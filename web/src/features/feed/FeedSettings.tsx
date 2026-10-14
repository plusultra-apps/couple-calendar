import { useState } from 'react'
import { Button, Card, ErrorText, Spinner } from '../../components/ui'
import { toMessage } from '../../lib/supabase'
import { feedUrl, useFeedToken, useRotateFeedToken, webcalUrl } from './queries'

// 설정 > 기본 캘린더에 표시 (ICS 구독 주소)
export function FeedSettings() {
  const token = useFeedToken()
  const rotateMut = useRotateFeedToken()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const url = token.data ? feedUrl(token.data) : ''

  const copy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('복사하지 못했어요. 주소를 길게 눌러 직접 복사해 주세요')
    }
  }

  const rotate = () => {
    if (!window.confirm('새 주소를 발급할까요?\n지금 주소로 구독 중인 캘린더는 더 이상 갱신되지 않아요.')) return
    setError('')
    rotateMut.mutate(undefined, { onError: (e) => setError(toMessage(e)) })
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">휴대폰 기본 캘린더에 표시</h2>
      <p className="text-sm text-ink-soft">
        아래 주소를 구독하면 우리달력 일정과 기념일이 휴대폰 기본 캘린더(위젯 포함)에 보여요. 읽기 전용이에요.
      </p>

      {token.isPending ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : token.isError ? (
        <ErrorText>{toMessage(token.error)}</ErrorText>
      ) : (
        <>
          <p className="rounded-2xl bg-bg p-3 font-mono text-xs break-all select-all">{url}</p>
          <div className="flex gap-2">
            <Button variant="soft" onClick={copy}>
              {copied ? '복사됨' : '주소 복사'}
            </Button>
            <a
              href={webcalUrl(token.data)}
              className="font-display press-3d flex h-13 w-full items-center justify-center whitespace-nowrap rounded-full bg-accent px-3 text-base text-white [--shade:var(--color-accent-deep)]"
            >
              아이폰에 추가
            </a>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 text-sm text-ink-soft">
        <p>
          <b className="text-ink">아이폰</b> · 위 "아이폰에 추가" → 구독 → 추가
        </p>
        <p>
          <b className="text-ink">갤럭시</b> · 삼성 캘린더는 주소 구독을 지원하지 않아요. PC에서 Google 캘린더 웹 → 왼쪽
          "다른 캘린더 +" → "URL로 추가"에 주소를 붙여 넣은 뒤, 휴대폰 삼성/구글 캘린더에서 그 구글 계정의 캘린더를
          표시하세요.
        </p>
        <p className="text-xs">구글 캘린더는 몇 시간에 한 번씩만 새로 가져와서 반영이 늦을 수 있어요.</p>
      </div>

      <Button variant="ghost" onClick={rotate} disabled={rotateMut.isPending || token.isPending}>
        {rotateMut.isPending ? '발급 중…' : '주소 재발급'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
