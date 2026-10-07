import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Api, BackupSnapshot, ConfigView } from '@shared/api'
import { previousMonth } from '@shared/month'
import { loadApi } from './api'
import { clearForcedState, useForcedState } from './dev/stateOverride'
import { placeholderConfig, placeholderSnapshot } from './dev/placeholders'
import type { StateId } from './design'

export interface Selection {
  sourceIds: number[]
  cleanUp: boolean
  /** "YYYY-MM"; defaults to last month. */
  month: string
}

interface AppState {
  api: Api | null
  config: ConfigView | null
  snapshot: BackupSnapshot | null
  loaded: boolean
  loadError: string | null
  forced: StateId | null
  selection: Selection
  setSelection(selection: Selection): void
  reloadConfig(): Promise<void>
  /** Runs a user action. Clears any dev `?state=` override first, so the real state takes over. */
  act<T>(action: (api: Api) => Promise<T>): Promise<T>
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const forced = useForcedState()
  const [api, setApi] = useState<Api | null>(null)
  const [config, setConfig] = useState<ConfigView | null>(null)
  const [snapshot, setSnapshot] = useState<BackupSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null until the user changes it: then every ready source is selected.
  const [chosen, setChosen] = useState<Selection | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    loadApi()
      .then(async (a) => {
        unsubscribe = a.backup.onUpdate(setSnapshot)
        const [c, s] = await Promise.all([a.config.get(), a.backup.getStatus()])
        if (cancelled) return
        setApi(a)
        setConfig(c)
        setSnapshot(s)
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const reloadConfig = useCallback(async () => {
    if (api) setConfig(await api.config.get())
  }, [api])

  const act = useCallback(
    async <T,>(action: (api: Api) => Promise<T>): Promise<T> => {
      if (!api) throw new Error('Not loaded yet')
      clearForcedState()
      return action(api)
    },
    [api]
  )

  // With a dev override, show the forced state's placeholder data.
  // (The DEV check lets production builds drop the placeholders entirely.)
  const shownConfig = import.meta.env.DEV && forced ? placeholderConfig(true) : config
  const shownSnapshot = import.meta.env.DEV && forced ? placeholderSnapshot(forced) : snapshot

  const selection = useMemo<Selection>(() => {
    const ready = (shownConfig?.sources ?? []).filter((s) => s.configured).map((s) => s.id)
    if (!chosen) return { sourceIds: ready, cleanUp: false, month: previousMonth(new Date()) }
    return {
      sourceIds: chosen.sourceIds.filter((id) => ready.includes(id)),
      cleanUp: chosen.cleanUp,
      month: chosen.month
    }
  }, [chosen, shownConfig])

  const value: AppState = {
    api,
    config: shownConfig,
    snapshot: shownSnapshot,
    loaded: !!api && !!config && !!snapshot,
    loadError,
    forced,
    selection,
    setSelection: (s) => {
      clearForcedState()
      setChosen(s)
    },
    reloadConfig,
    act
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState outside AppStateProvider')
  return ctx
}
