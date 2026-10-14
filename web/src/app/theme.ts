import { useState } from 'react'

// 화면 테마. 휴대폰마다(=사람마다) 따로 저장한다. 색 값은 index.css 의 [data-theme] 블록
export const THEMES = [
  { id: 'pink', label: '딸기우유', bg: '#FFF4F8', soft: '#F8B4C4', accent: '#FF8DB3' },
  { id: 'sky', label: '하늘', bg: '#F1F6FC', soft: '#B5D3F0', accent: '#5B9BD5' },
  { id: 'mint', label: '민트', bg: '#F0F8F4', soft: '#A8DCC0', accent: '#4DB38A' },
  { id: 'mocha', label: '모카', bg: '#F7F4EF', soft: '#E3D3BF', accent: '#B08968' },
  { id: 'simple', label: '심플', bg: '#F5F6F8', soft: '#CDD3DC', accent: '#5C6B80' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const KEY = 'ourcal.theme'

function read(): ThemeId {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'pink'
  } catch {
    return 'pink'
  }
}

export function applyTheme(id: ThemeId = read()) {
  const root = document.documentElement
  if (id === 'pink') delete root.dataset.theme
  else root.dataset.theme = id
  // 휴대폰 상단바 색
  const t = THEMES.find((x) => x.id === id)!
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.accent)
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(read)
  const change = (id: ThemeId) => {
    setTheme(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* 저장 못 해도 지금 화면엔 적용 */
    }
    applyTheme(id)
  }
  return [theme, change] as const
}
