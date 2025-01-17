import Color from 'color'
import { useEffect, useState, useRef } from 'react'
import { useAsync, useWindowSize } from 'react-use'
import { useCollectionByTwitterHandler } from '@masknet/shared'
import { makeStyles } from '@masknet/theme'
import { MutationObserverWatcher } from '@dimensiondev/holoflows-kit'
import { untilElementAvailable } from '../../../utils/index.js'
import { attachReactTreeWithContainer } from '../../../utils/shadow-root.js'
import type { NonFungibleCollectionResult, FungibleTokenResult } from '@masknet/web3-shared-base'
import { useSnapshotSpacesByTwitterHandler } from '@masknet/web3-hooks-base'
import { ProfileTabs, PluginID, MaskMessages, BooleanPreference } from '@masknet/shared-base'
import type { Web3Helper } from '@masknet/web3-helpers'
import {
    searchAppBarBackSelector,
    searchNewTweetButtonSelector,
    searchProfileEmptySelector,
    searchProfileTabListLastChildSelector,
    searchProfileTabListSelector,
    searchProfileTabPageSelector,
    searchProfileTabSelector,
    searchProfileTabLoseConnectionPageSelector,
    searchNameTag,
    isProfilePageLike,
    nextTabListSelector,
} from '../utils/selector.js'
import { useCurrentVisitingIdentity } from '../../../components/DataSource/useActivatedUI.js'
import Services from '#services'
import { ProfileTab } from '../../../components/InjectedComponents/ProfileTab.js'
import { startWatch } from '../../../utils/startWatch.js'

function getStyleProps() {
    const EMPTY_STYLE = {} as CSSStyleDeclaration
    const eleTab = searchProfileTabSelector().evaluate()?.querySelector('div > div')
    const style = eleTab ? window.getComputedStyle(eleTab) : EMPTY_STYLE
    const paddingEle = searchProfileTabSelector().evaluate()
    const paddingCss = paddingEle ? window.getComputedStyle(paddingEle) : EMPTY_STYLE
    const eleNewTweetButton = searchNewTweetButtonSelector().evaluate()
    const newTweetButtonColorStyle = eleNewTweetButton ? window.getComputedStyle(eleNewTweetButton) : EMPTY_STYLE
    const eleBackButton = searchAppBarBackSelector().evaluate()
    const backButtonColorStyle = eleBackButton ? window.getComputedStyle(eleBackButton) : EMPTY_STYLE

    return {
        color: style.color,
        font: style.font,
        fontSize: style.fontSize,
        padding: style.paddingBottom,
        paddingX: paddingCss.paddingLeft || '16px',
        height: style.height || '53px',
        hover: backButtonColorStyle.color,
        line: newTweetButtonColorStyle.backgroundColor,
    }
}

const useStyles = makeStyles<{ minWidth?: number }>()((theme, { minWidth }) => {
    const props = getStyleProps()
    return {
        root: {
            '&:hover': {
                backgroundColor: new Color(props.hover).alpha(0.1).toString(),
                cursor: 'pointer',
            },
            height: props.height,
            display: 'inline-block',
        },
        button: {
            zIndex: 1,
            position: 'relative',
            display: 'flex',
            minWidth: minWidth ?? 56,
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            paddingLeft: props.paddingX,
            paddingRight: props.paddingX,
            color: props.color,
            font: props.font,
            fontSize: props.fontSize,
            fontWeight: 500,
            '&:hover': {
                color: props.color,
            },
            height: props.height,
        },
        selected: {
            color: `${props.hover} !important`,
            fontWeight: 700,
        },
        line: {
            borderRadius: 9999,
            position: 'absolute',
            bottom: 0,
            minWidth: 56,
            alignSelf: 'center',
            height: 4,
            backgroundColor: props.line,
        },
        bar: {
            display: 'flex',
            zIndex: 0,
            position: 'relative',
            minWidth: 56,
        },
    }
})

function nameTagClickHandler() {
    MaskMessages.events.profileTabUpdated.sendToLocal({ show: false })
    MaskMessages.events.profileTabActive.sendToLocal({ active: false })
    const nameTag = searchNameTag().evaluate()
    if (nameTag) nameTag.style.display = ''

    const eleEmpty = searchProfileEmptySelector().evaluate()
    if (eleEmpty) eleEmpty.style.display = 'none'

    const elePage = searchProfileTabPageSelector().evaluate()
    if (elePage) {
        elePage.style.visibility = 'hidden'
        elePage.style.height = 'auto'
    }
}

function tabClickHandler() {
    MaskMessages.events.profileTabUpdated.sendToLocal({ show: false })
    MaskMessages.events.profileTabActive.sendToLocal({ active: false })

    resetTwitterActivatedContent()
}

async function hideTwitterActivatedContent() {
    const eleTab = searchProfileTabSelector().evaluate()?.querySelector('div > div')
    const loseConnectionEle = searchProfileTabLoseConnectionPageSelector().evaluate()
    if (!eleTab) return
    const style = window.getComputedStyle(eleTab)
    // hide the activated indicator
    const tabList = searchProfileTabListSelector().evaluate()
    tabList.map((v) => {
        const _v = v.querySelector<HTMLDivElement>('div > div')
        if (_v) _v.style.color = style.color

        const line = v.querySelector<HTMLDivElement>('div > div > div')
        if (line) line.style.display = 'none'
        v.addEventListener('click', v.closest('#open-nft-button') ? nameTagClickHandler : tabClickHandler)
    })

    if (loseConnectionEle) return

    // hide the empty list indicator on the page
    const eleEmpty = searchProfileEmptySelector().evaluate()
    if (eleEmpty) eleEmpty.style.display = 'none'

    const nameTag = searchNameTag().evaluate()
    if (nameTag) nameTag.style.display = 'none'

    // hide the content page
    await untilElementAvailable(searchProfileTabPageSelector())

    const elePage = searchProfileTabPageSelector().evaluate()
    if (elePage) {
        elePage.style.visibility = 'hidden'
        elePage.style.height = 'auto'
    }
}

function resetTwitterActivatedContent() {
    const eleTab = searchProfileTabSelector().evaluate()?.querySelector('div > div')
    const loseConnectionEle = searchProfileTabLoseConnectionPageSelector().evaluate()
    if (!eleTab) return

    const tabList = searchProfileTabListSelector().evaluate()
    tabList.map((v) => {
        const _v = v.querySelector<HTMLDivElement>('div > div')
        if (_v) _v.style.color = ''
        const line = v.querySelector<HTMLDivElement>('div > div > div')
        if (line) line.style.display = ''
        v.removeEventListener('click', v.closest('#open-nft-button') ? nameTagClickHandler : tabClickHandler)
    })

    if (loseConnectionEle) return

    const eleEmpty = searchProfileEmptySelector().evaluate()
    if (eleEmpty) eleEmpty.style.display = ''

    const elePage = searchProfileTabPageSelector().evaluate()
    if (elePage) {
        elePage.style.visibility = 'visible'
        elePage.style.height = 'auto'
    }
}

function ProfileTabForTokenAndPersona() {
    const [hidden, setHidden] = useState(false)
    const currentVisitingSocialIdentity = useCurrentVisitingIdentity()
    const currentVisitingUserId = currentVisitingSocialIdentity?.identifier?.userId
    const { value: collectionList, loading } = useCollectionByTwitterHandler(currentVisitingUserId)
    const collectionResult = collectionList?.[0]
    const twitterHandler =
        (collectionResult as NonFungibleCollectionResult<Web3Helper.ChainIdAll, Web3Helper.SchemaTypeAll>)?.collection
            ?.socialLinks?.twitter ||
        (collectionResult as FungibleTokenResult<Web3Helper.ChainIdAll, Web3Helper.SchemaTypeAll>)?.socialLinks?.twitter
    const { classes } = useStyles({
        minWidth:
            currentVisitingUserId && twitterHandler?.toLowerCase().endsWith(currentVisitingUserId.toLowerCase()) ?
                0
            :   56,
    })
    useEffect(() => {
        return MaskMessages.events.profileTabHidden.on((data) => {
            setHidden(data.hidden)
        })
    }, [])

    return hidden || loading ? null : (
            <ProfileTab
                title={
                    (
                        currentVisitingUserId &&
                        twitterHandler?.toLowerCase().endsWith(currentVisitingUserId.toLowerCase())
                    ) ?
                        'More'
                    :   'Web3'
                }
                type={ProfileTabs.WEB3}
                classes={{
                    root: classes.root,
                    button: classes.button,
                    selected: classes.selected,
                }}
                reset={resetTwitterActivatedContent}
                clear={hideTwitterActivatedContent}
                children={<div className={classes.line} />}
            />
        )
}

function ProfileTabForDAO() {
    const currentVisitingSocialIdentity = useCurrentVisitingIdentity()
    const currentVisitingUserId = currentVisitingSocialIdentity?.identifier?.userId ?? ''
    const { value: spaceList, loading } = useSnapshotSpacesByTwitterHandler(currentVisitingUserId)

    const { value: snapshotDisabled } = useAsync(() => {
        return Services.Settings.getPluginMinimalModeEnabled(PluginID.Snapshot)
    }, [])

    const [hidden, setHidden] = useState(snapshotDisabled === BooleanPreference.True)
    const { classes } = useStyles({ minWidth: hidden ? 56 : 0 })
    useEffect(() => {
        return MaskMessages.events.profileTabHidden.on((data) => {
            setHidden(data.hidden)
        })
    }, [])

    return hidden || loading || !spaceList?.length ?
            null
        :   <ProfileTab
                title="DAO"
                type={ProfileTabs.DAO}
                classes={{
                    root: classes.root,
                    button: classes.button,
                    selected: classes.selected,
                }}
                reset={resetTwitterActivatedContent}
                clear={hideTwitterActivatedContent}
                children={<div className={classes.line} />}
            />
}

export function injectProfileTabAtTwitter(signal: AbortSignal) {
    let tabInjected = false
    const contentWatcher = new MutationObserverWatcher(searchProfileTabPageSelector()).useForeach(() => {
        const elePage = searchProfileTabPageSelector().evaluate()
        if (elePage && !tabInjected) {
            const watcher = new MutationObserverWatcher(searchProfileTabListLastChildSelector())
            startWatch(watcher, {
                signal,
                missingReportRule: {
                    name: 'Last tab in the profile page',
                    rule: isProfilePageLike,
                },
                shadowRootDelegatesFocus: false,
            })
            attachReactTreeWithContainer(watcher.firstDOMProxy.afterShadow, { signal }).render(<InjectProfileTab />)
            tabInjected = true
        }
    })

    startWatch(contentWatcher, {
        signal,
        missingReportRule: { name: 'ProfileTab', rule: isProfilePageLike },
        shadowRootDelegatesFocus: false,
    })
}

function showNextArrow() {
    const next = nextTabListSelector().evaluate()
    if (!next) return

    next.style.setProperty('pointer-events', 'auto', 'important')
    next.style.opacity = '1'

    const first = next.firstElementChild as HTMLDivElement
    if (!first) return
    first.style.backgroundColor = 'rgba(39, 44, 48, 0.75)'
    first.style.opacity = '1'
    const svg = next.querySelector('svg')
    if (!svg) return
    svg.style.color = 'rgb(255, 255, 255)'
}

function hiddenNextArrow() {
    const next = nextTabListSelector().evaluate()
    if (!next) return
    next.style.removeProperty('opacity')
    next.style.removeProperty('pointer-events')

    const first = next.firstElementChild as HTMLDivElement
    if (!first) return
    first.style.backgroundColor = 'rgba(15, 20, 25, 0.75)'
    first.style.removeProperty('opacity')
    const svg = next.querySelector('svg')
    if (!svg) return
    svg.style.removeProperty('color')
}

function InjectProfileTab() {
    const web3TabRef = useRef<HTMLDivElement>(null)
    const { classes } = useStyles({ minWidth: 56 })
    const windowSize = useWindowSize()
    const timeoutRef = useRef<any>()
    const [isClick, setIsClick] = useState(false)

    function onMouseEnter() {
        if (isClick) return
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        const parent = searchProfileTabListLastChildSelector().closest<HTMLElement>(1).evaluate()
        if (!parent || !web3TabRef.current) return
        if (Math.abs(parent.scrollWidth - (parent.scrollLeft + parent.clientWidth)) < 10) return
        if (parent.clientWidth < parent.scrollWidth) {
            showNextArrow()
        }
    }

    function onNextClick() {
        const nextArrow = nextTabListSelector().evaluate()
        if (!nextArrow) return
        nextArrow.style.removeProperty('cursor')
        setIsClick(true)
        hiddenNextArrow()
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = null
    }

    function onMouseLeave() {
        if (!timeoutRef.current) timeoutRef.current = setTimeout(hiddenNextArrow, 500)
        setIsClick(false)
    }

    function onEnterNextArrow() {
        if (isClick) return
        const nextArrow = nextTabListSelector().evaluate()
        if (!nextArrow) return
        nextArrow.style.cursor = 'pointer'
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = null

        showNextArrow()
    }

    function onLeaveNextArrow() {
        const nextArrow = nextTabListSelector().evaluate()
        if (!nextArrow) return
        nextArrow.style.removeProperty('cursor')
        onMouseLeave()
    }

    const tabList = searchProfileTabListSelector().evaluate()
    const nextArrow = nextTabListSelector().evaluate()
    useEffect(() => {
        web3TabRef.current?.addEventListener('mouseenter', onMouseEnter)
        web3TabRef.current?.addEventListener('mouseleave', onMouseLeave)
        nextArrow?.addEventListener('click', onNextClick)
        nextArrow?.addEventListener('mouseenter', onEnterNextArrow)
        nextArrow?.addEventListener('mouseleave', onLeaveNextArrow)
        tabList.map((v) => {
            v.closest('div')?.addEventListener('mouseenter', onMouseEnter)
            v.closest('div')?.addEventListener('mouseleave', onMouseLeave)
        })
        return () => {
            web3TabRef.current?.removeEventListener('mouseenter', onMouseEnter)
            web3TabRef.current?.removeEventListener('mouseleave', onMouseLeave)
            nextArrow?.removeEventListener('click', onNextClick)
            nextArrow?.removeEventListener('mouseenter', onEnterNextArrow)
            nextArrow?.removeEventListener('mouseleave', onLeaveNextArrow)
            tabList.map((v) => {
                v.closest('div')?.removeEventListener('mouseenter', onMouseEnter)
                v.closest('div')?.removeEventListener('mouseleave', onMouseLeave)
            })
        }
    }, [windowSize, tabList, web3TabRef.current, nextArrow])

    return (
        <div ref={web3TabRef} className={classes.bar}>
            <ProfileTabForTokenAndPersona />
            <ProfileTabForDAO />
        </div>
    )
}
