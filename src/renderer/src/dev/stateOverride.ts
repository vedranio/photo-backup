// Dev only: `?state=<stateId>` forces a design state with placeholder data, e.g. /?state=st_vublspne
// or /#/home?state=st_vublspne. Inert in production builds. Any user action clears it.
import { useSyncExternalStore } from 'react'
import { isStateId, type StateId } from '../design'

function readFromLocation(): StateId | null {
  const hashQuery = window.location.hash.split('?')[1]
  const id =
    (hashQuery && new URLSearchParams(hashQuery).get('state')) ||
    new URLSearchParams(window.location.search).get('state')
  if (!id) return null
  if (!isStateId(id)) {
    console.warn(`?state=${id} isn't a state in .design/flows.json`)
    return null
  }
  return id
}

let forced: StateId | null = import.meta.env.DEV ? readFromLocation() : null
const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((l) => l())

if (import.meta.env.DEV) {
  window.addEventListener('hashchange', () => {
    const next = readFromLocation()
    if (next && next !== forced) {
      forced = next
      notify()
    }
  })
}

/** The forced state, read once at startup (or when the hash changes). Null in production. */
export function getForcedState(): StateId | null {
  return forced
}

export function clearForcedState(): void {
  if (!forced) return
  forced = null
  const url = new URL(window.location.href)
  url.searchParams.delete('state')
  const [hashPath, hashQuery] = url.hash.split('?')
  const params = new URLSearchParams(hashQuery)
  params.delete('state')
  url.hash = params.size ? `${hashPath}?${params}` : hashPath
  window.history.replaceState(window.history.state, '', url)
  notify()
}

export function useForcedState(): StateId | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => forced
  )
}
