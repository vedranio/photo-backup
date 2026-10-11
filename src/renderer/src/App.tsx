import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AppStateProvider, useAppState } from './AppState'
import { ROUTES, STATE_ROUTE } from './design'
import { Splash } from './screens/Splash'
import { Home } from './screens/home/Home'
import { Settings } from './screens/Settings'
import { ConfirmCancel } from './screens/ConfirmCancel'

/** Dev only: sends a `?state=` override to its screen's route. */
function ForcedStateRoute(): null {
  const { forced } = useAppState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (forced && STATE_ROUTE[forced] !== pathname) navigate(STATE_ROUTE[forced], { replace: true })
  }, [forced, pathname, navigate])
  return null
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div className="app-frame">
        <AppStateProvider>
          {import.meta.env.DEV && <ForcedStateRoute />}
          <Routes>
            <Route path="/" element={<Navigate to={ROUTES.splash} replace />} />
            <Route path={ROUTES.splash} element={<Splash />} />
            <Route path={ROUTES.home} element={<Home />} />
            {/* Settings and Confirm cancel are modals over Home. */}
            <Route
              path={ROUTES.settings}
              element={
                <>
                  <Home />
                  <Settings />
                </>
              }
            />
            <Route
              path={ROUTES.confirmCancel}
              element={
                <>
                  <Home />
                  <ConfirmCancel />
                </>
              }
            />
            <Route path="*" element={<Navigate to={ROUTES.splash} replace />} />
          </Routes>
        </AppStateProvider>
      </div>
    </HashRouter>
  )
}

export default App
