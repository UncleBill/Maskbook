import { MutationObserverWatcher, ValueRef } from '@dimensiondev/holoflows-kit'
import { createSubscriptionFromValueRef } from '@masknet/shared-base'
import type { PaletteMode } from '@mui/material'
import type { SocialNetworkUI } from '@masknet/types'
import { themeSelector } from '../utils/selectors.js'

const currentTheme = new ValueRef<PaletteMode>('light')

export const PaletteModeProviderMirror: SocialNetworkUI.Customization.PaletteModeProvider = {
    current: createSubscriptionFromValueRef(currentTheme),
    start: startWatchThemeColor,
}

export async function startWatchThemeColor(signal: AbortSignal) {
    function updateThemeColor() {
        currentTheme.value = (document.documentElement.dataset.theme as PaletteMode) ?? 'light'
    }

    new MutationObserverWatcher(themeSelector())
        .addListener('onAdd', updateThemeColor)
        .addListener('onChange', updateThemeColor)
        .startWatch({ childList: true, subtree: true }, signal)
}
