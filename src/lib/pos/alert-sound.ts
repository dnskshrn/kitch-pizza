const POS_NEW_ORDER_CHIME_URL = "/pos-new-order-chime.wav"

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

let audioCtx: AudioContext | null = null
let chimeAudio: HTMLAudioElement | null = null
let unlocked = false

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (audioCtx) return audioCtx

  const win = window as AudioWindow
  const Ctor = window.AudioContext ?? win.webkitAudioContext
  if (!Ctor) return null

  audioCtx = new Ctor()
  return audioCtx
}

function getChimeAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null
  if (chimeAudio) return chimeAudio

  const audio = new Audio(POS_NEW_ORDER_CHIME_URL)
  audio.preload = "auto"
  audio.volume = 0.9
  chimeAudio = audio
  return audio
}

function playOscillatorPing(ctx: AudioContext): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = "sine"
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.setValueAtTime(1175, now + 0.12)
  osc.frequency.setValueAtTime(988, now + 0.24)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
  osc.start(now)
  osc.stop(now + 0.5)
}

async function playHtmlChime(): Promise<boolean> {
  const audio = getChimeAudio()
  if (!audio) return false

  try {
    audio.pause()
    audio.currentTime = 0
    await audio.play()
    return true
  } catch {
    return false
  }
}

async function unlockHtmlAudio(): Promise<boolean> {
  const audio = getChimeAudio()
  if (!audio) return false

  try {
    audio.muted = true
    audio.currentTime = 0
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    audio.muted = false
    return true
  } catch {
    audio.muted = false
    return false
  }
}

export function isPosAlertSoundUnlocked(): boolean {
  return unlocked
}

export async function unlockPosAlertSound(): Promise<boolean> {
  const ctx = getAudioContext()
  let webAudioReady = false

  try {
    if (ctx) {
      if (ctx.state === "suspended") {
        await ctx.resume()
      }
      if (ctx.state === "running") {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        osc.start()
        osc.stop(ctx.currentTime + 0.03)
        webAudioReady = true
      }
    }
  } catch {
    webAudioReady = false
  }

  const htmlAudioReady = await unlockHtmlAudio()
  unlocked = webAudioReady || htmlAudioReady
  return unlocked
}

export async function playPosAlertSound(): Promise<boolean> {
  const ctx = getAudioContext()
  let played = false

  try {
    if (ctx?.state === "suspended") {
      await ctx.resume()
    }
    if (ctx?.state === "running") {
      playOscillatorPing(ctx)
      played = true
      unlocked = true
    }
  } catch {
    // Fallback ниже попробует HTMLAudio.
  }

  const htmlPlayed = await playHtmlChime()
  if (htmlPlayed) {
    played = true
    unlocked = true
  }

  return played
}
