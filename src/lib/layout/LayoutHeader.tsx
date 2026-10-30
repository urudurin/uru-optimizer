import {
  Button,
  Flex,
} from '@mantine/core'
import {
  IconMenu2,
  IconX,
} from '@tabler/icons-react'
import { SavedSessionKeys } from 'lib/constants/constantsSession'
import { useGameStore } from 'lib/games/gameStore'
import { GameSwitcher } from 'lib/games/GameSwitcher'
import {
  OpenCloseIDs,
  useOpenClose,
} from 'lib/hooks/useOpenClose'
import { LanguageSelector } from 'lib/i18n/LanguageSelector'
import classes from 'lib/layout/layout.module.css'
import { Assets } from 'lib/rendering/assets'
import { SaveState } from 'lib/state/saveState'
import { useGlobalStore } from 'lib/stores/app/appStore'
import { BASE_PATH } from 'lib/tabs/navigation/constants'

export const HEADER_HEIGHT = 48

export function LayoutHeader() {
  const { isOpen: isOpenMenuSidebar, toggle: toggleMenuSidebar } = useOpenClose(OpenCloseIDs.MENU_SIDEBAR)
  const activeGame = useGameStore((s) => s.activeGame)
  const home = useGameStore((s) => s.home)
  const goHome = useGameStore((s) => s.goHome)

  const handleToggleSidebar = () => {
    toggleMenuSidebar()
    // Persist the new collapsed state (toggled = opposite of current)
    useGlobalStore.getState().setSavedSessionKey(SavedSessionKeys.sidebarCollapsed, isOpenMenuSidebar)
    SaveState.delayedSave()
  }

  return (
    <header className={classes.header} style={{ height: HEADER_HEIGHT }}>
      <Flex align='center' justify='space-between' className={classes.headerInner}>
        <Flex gap={8} align='center'>
          <Flex align='center' justify='center' style={{ width: 56, minWidth: 56 }}>
            <Button
              variant='transparent'
              onClick={handleToggleSidebar}
              className={classes.menuButton}
            >
              {isOpenMenuSidebar ? <IconX size={16} /> : <IconMenu2 size={16} />}
            </Button>
          </Flex>
          <a
            href={BASE_PATH}
            style={{ textDecoration: 'none', color: 'inherit' }}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              e.preventDefault()
              // The site's Home tab (lib/games/GamePicker.tsx); HSR's own home page stays in its sidebar
              goHome()
            }}
          >
            <Flex align='center'>
              <img src={Assets.getLogo()} className={classes.logo} />
              <div className={classes.title}>
                Uru's Gacha Optimizer
              </div>
            </Flex>
          </a>
        </Flex>
        <Flex align='center' gap={6}>
          <GameSwitcher />
          {/* fribbels' Discord is for the HSR optimizer only, so it isn't shown for the other games */}
          {!home && activeGame === 'hsr' && (
            <a href='https://discord.gg/rDmB4Un7qg' target='_blank' rel='noreferrer'>
              <img src={Assets.getDiscord()} style={{ height: 32, borderRadius: 5, display: 'block' }} />
            </a>
          )}
          <LanguageSelector />
        </Flex>
      </Flex>
    </header>
  )
}
