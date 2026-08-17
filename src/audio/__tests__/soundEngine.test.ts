// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'

class FakeOscillator {
  type = 'sine'
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGain {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
}

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  sampleRate = 44100
  destination = {}
  resume = vi.fn()
  createGain = vi.fn(() => new FakeGain())
  createOscillator = vi.fn(() => new FakeOscillator())
  createBuffer = vi.fn((_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  }))
  createBufferSource = vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadEngine() {
  vi.resetModules()
  return await import('../soundEngine')
}

describe('soundEngine', () => {
  it('no-ops when AudioContext is unavailable', async () => {
    const { playSound, SoundId } = await loadEngine()
    expect(() => playSound(SoundId.Click)).not.toThrow()
  })

  it('creates an oscillator for a tonal sound', async () => {
    const FakeAC = vi.fn(function () { return new FakeAudioContext() })
    vi.stubGlobal('AudioContext', FakeAC)
    const { playSound, SoundId } = await loadEngine()
    playSound(SoundId.Buy)
    const ctx = FakeAC.mock.results[0].value as FakeAudioContext
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
    expect(ctx.createGain).toHaveBeenCalledTimes(3)
  })

  it('creates noise buffers for the dice roll', async () => {
    const FakeAC = vi.fn(function () { return new FakeAudioContext() })
    vi.stubGlobal('AudioContext', FakeAC)
    const { playSound, SoundId } = await loadEngine()
    playSound(SoundId.DiceRoll)
    const ctx = FakeAC.mock.results[0].value as FakeAudioContext
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(3)
  })

  it('creates oscillators for the your-turn chime', async () => {
    const FakeAC = vi.fn(function () { return new FakeAudioContext() })
    vi.stubGlobal('AudioContext', FakeAC)
    const { playSound, SoundId } = await loadEngine()
    playSound(SoundId.YourTurn)
    const ctx = FakeAC.mock.results[0].value as FakeAudioContext
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
    expect(ctx.createGain).toHaveBeenCalledTimes(3)
  })
})
