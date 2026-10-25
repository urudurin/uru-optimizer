import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { useGameStore } from 'lib/games/gameStore'
import { ConfirmModalProvider } from 'lib/interactions/confirmModal'
import { checkForUpdatesNotification } from 'lib/interactions/notifications'
import { LayoutHeader } from 'lib/layout/LayoutHeader'
import { LayoutSider } from 'lib/layout/LayoutSider'
import { GlobalModals } from 'lib/overlays/GlobalModals'
import { Gradient } from 'lib/rendering/gradient'
import { useGlobalStore } from 'lib/stores/app/appStore'
import { useThemeStore } from 'lib/stores/themeStore'
import { Tabs } from 'lib/tabs/Tabs'
import {
  createMantineTheme,
  themeResolver,
} from 'lib/ui/theme'

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
} from 'react'

// Loaded on first use so HSR-only users never download ZZZ code
const ZzzApp = lazy(() => import('lib/games/zzz/ZzzApp').then((m) => ({ default: m.ZzzApp })))
const WuwaApp = lazy(() => import('lib/games/wuwa/WuwaApp').then((m) => ({ default: m.WuwaApp })))

// Initial gradient setup before first render
{
  const initTheme = createMantineTheme(useThemeStore.getState().seedColor)
  Gradient.setTheme(initTheme.colors!.dark![8], initTheme.colors!.primary![4])
}

export function App() {
  const seedColor = useThemeStore((s) => s.seedColor)
  const activeGame = useGameStore((s) => s.activeGame)
  const mantineTheme = useMemo(() => createMantineTheme(seedColor), [seedColor])

  useEffect(() => {
    Gradient.setTheme(mantineTheme.colors!.dark![8], mantineTheme.colors!.primary![4])
  }, [mantineTheme])

  useEffect(() => {
    const timerId = setTimeout(() => checkForUpdatesNotification(useGlobalStore.getState().version), 1000)
    return () => clearTimeout(timerId)
  }, [])

  return (
    <MantineProvider theme={mantineTheme} cssVariablesResolver={themeResolver} defaultColorScheme='dark'>
      <ModalsProvider>
        <Notifications position='top-right' />
        <ConfirmModalProvider>
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <LayoutHeader />
            {/* HSR stays mounted while another game is shown, so in-progress HSR state isn't lost */}
            <div style={{ display: activeGame === 'hsr' ? 'flex' : 'none', flex: 1 }}>
              <LayoutSider />
              <div
                style={{
                  padding: '10px 10px 0 10px',
                  margin: '0 auto',
                  minHeight: 280,
                  overflow: 'initial',
                  display: 'flex',
                  justifyContent: 'space-around',
                  width: '100%',
                }}
              >
                <Tabs />
              </div>
            </div>
            {activeGame === 'zzz' && (
              <Suspense fallback={null}>
                <ZzzApp />
              </Suspense>
            )}
            {activeGame === 'wuwa' && (
              <Suspense fallback={null}>
                <WuwaApp />
              </Suspense>
            )}
          </div>
          <GlobalModals />
        </ConfirmModalProvider>
      </ModalsProvider>
    </MantineProvider>
  )
}
