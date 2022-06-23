import { cloneElement, FC, memo, useContext, useMemo } from 'react'
import { useTheme } from '@mui/material'
// import icons, { IconType } from './icon-data'
import { MaskIconPaletteContext } from './utils/MaskIconPaletteContext'

export interface IconProps extends React.HTMLProps<HTMLSpanElement> {
    iconUrl?: string
    size?: number
    color?: string
    variant?: 'dark' | 'dim' | 'light'
}

type ThemeTuple<T> = [light: T | undefined, dark: T | undefined, dim: T | undefined]

interface CreateIconOptions {
    jsx?: JSX.Element | ThemeTuple<JSX.Element>
    iconUrl?: string | ThemeTuple<string>
}

export function createIcon({ jsx, iconUrl }: CreateIconOptions): FC<IconProps> {
    const [darkJsx, lightJsx, dimJsx] = Array.isArray(jsx) ? jsx : jsx ? [jsx, jsx, jsx] : []
    const [darkUrl, lightUrl, dimUrl] = Array.isArray(iconUrl) ? iconUrl : iconUrl ? [iconUrl, iconUrl, iconUrl] : []

    const Icon: FC<IconProps> = memo(({ size, style, color, ...rest }) => {
        const palette = useContext(MaskIconPaletteContext)
        const theme = useTheme()
        const isDarkMode = theme.palette.mode === 'dark'
        const isDim = palette === 'dim'

        const jsxToRender = isDarkMode ? (isDim ? dimJsx : darkJsx) : lightJsx
        const iconUrlToRender = isDarkMode ? (isDim ? dimUrl : darkUrl) : lightUrl

        const iconStyle = useMemo(() => {
            const iconSize = size ?? 24
            const bg = jsxToRender
                ? null
                : {
                      backgroundImage: `url(${iconUrlToRender ?? rest.iconUrl})`,
                      backgroundSize: `${iconSize}px`,
                  }
            return {
                display: 'inline-block',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                flexShrink: 0,
                height: `${iconSize}px`,
                width: `${iconSize}px`,
                color,
                ...bg,
                ...style,
            }
        }, [size, color, !!jsxToRender, rest.iconUrl])

        if (jsxToRender) {
            return cloneElement(jsxToRender, {
                'aria-hidden': true,
                ...rest,
                style: iconStyle,
            })
        }
        return <span aria-hidden="true" {...rest} style={iconStyle} />
    })
    return Icon
}

// export { icons }

// export type { IconType }
