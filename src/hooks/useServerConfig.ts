import { useEffect, useState } from 'react'
import { HttpPath } from '../types/net'

export function useServerConfig() {
  const [seedEnabled, setSeedEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(HttpPath.Config)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { seedEnabled?: boolean } | null) => {
        if (cancelled) return
        setSeedEnabled(data?.seedEnabled ?? false)
      })
      .catch(() => {
        if (!cancelled) setSeedEnabled(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { seedEnabled, loading }
}