// 콩 소리: 콩끼리·벽에 부딪히는 소리를 짧은 "딱" 소리로 합성한다 (음원 파일 없음).
// 브라우저는 사용자가 누른 뒤에야 소리를 내게 해서, 처음 누를 때 unlockBeanSound() 를 부른다.

const KEY = 'ourcal.beans.sound' // 이 휴대폰에서만 기억 (1 = 켬, 0 = 끔)

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

export function beanSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setBeanSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* 저장 실패는 무시 */
  }
}

// 사용자 동작 안에서 부른다 (iOS 는 이때만 소리를 허용)
export function unlockBeanSound() {
  if (typeof window === 'undefined') return
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  if (!ctx) {
    ctx = new AC()
    const sr = ctx.sampleRate
    noise = ctx.createBuffer(1, Math.floor(sr * 0.05), sr)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4)
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

// intensity 0~1: 세게 부딪힐수록 크게. pitch: 콩 크기에 따라 (작은 콩 = 높은 소리)
export function beanClack(intensity: number, pitch: number) {
  if (!ctx || !noise || ctx.state !== 'running' || !beanSoundOn()) return
  const t = ctx.currentTime
  const vol = Math.min(0.5, 0.06 + intensity * 0.45)

  const src = ctx.createBufferSource()
  src.buffer = noise
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = pitch
  band.Q.value = 7
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  src.connect(band).connect(g).connect(ctx.destination)
  src.start(t)

  // 콩 껍질이 "톡" 하는 짧은 음
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(pitch * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.9, t + 0.03)
  const og = ctx.createGain()
  og.gain.setValueAtTime(vol * 0.35, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
  osc.connect(og).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.035)
}
