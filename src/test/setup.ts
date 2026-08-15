function installMemoryStorageIfNeeded() {
  try {
    if (
      typeof globalThis.localStorage !== 'undefined' &&
      typeof globalThis.localStorage.setItem === 'function'
    ) {
      globalThis.localStorage.setItem('__probe__', '1')
      globalThis.localStorage.removeItem('__probe__')
      return
    }
  } catch {
    // storage absent or unusable — replace with in-memory storage below
  }
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() { return store.size },
      clear: () => store.clear(),
      getItem: (k: string) => store.get(k) ?? null,
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => { store.delete(k) },
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
    } satisfies Storage,
  })
}
installMemoryStorageIfNeeded()
localStorage.setItem('monopoly-language', 'en')
localStorage.setItem('monopoly-currency', 'USD')
