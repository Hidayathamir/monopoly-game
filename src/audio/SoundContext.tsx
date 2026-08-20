import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { playSound, unlockAudio } from './soundEngine'
import type { SoundId } from './soundEngine'

const SoundContext = createContext<(id: SoundId) => void>(() => {})

export function SoundProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unlock = () => {
      if (unlockAudio()) return
      document.addEventListener('pointerdown', unlock, { capture: true, once: true })
      document.addEventListener('keydown', unlock, { capture: true, once: true })
    }
    document.addEventListener('pointerdown', unlock, { capture: true, once: true })
    document.addEventListener('keydown', unlock, { capture: true, once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock, { capture: true })
      document.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])
  const play = useCallback((id: SoundId) => playSound(id), [])
  const value = useMemo(() => play, [play])
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSound(): (id: SoundId) => void {
  return useContext(SoundContext)
}
