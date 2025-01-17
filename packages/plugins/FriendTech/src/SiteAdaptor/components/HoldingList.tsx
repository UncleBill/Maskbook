import { ElementAnchor } from '@masknet/shared'
import { EMPTY_LIST } from '@masknet/shared-base'
import { makeStyles } from '@masknet/theme'
import { useAccount } from '@masknet/web3-hooks-base'
import { FriendTech } from '@masknet/web3-providers'
import { isSameAddress } from '@masknet/web3-shared-base'
import { Box, Link, Typography } from '@mui/material'
import { useInfiniteQuery } from '@tanstack/react-query'
import { range, uniqBy } from 'lodash-es'
import { memo, useMemo, type HTMLProps } from 'react'
import { Translate } from '../../locales/i18n_generated.js'
import { HoldingCard, HoldingCardSkeleton } from './HoldingCard.js'

const useStyles = makeStyles()((theme) => ({
    container: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        overscrollBehavior: 'contain',
        '&::-webkit-scrollbar': {
            display: 'none',
        },
    },
    holdings: {
        flexGrow: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'auto 1fr',
        gap: theme.spacing(1.5),
    },
    holdingCard: {
        overflow: 'auto',
    },
}))

interface Props extends HTMLProps<HTMLDivElement> {
    address: string
}
export const HoldingList = memo(function HoldingList({ address, ...rest }: Props) {
    const { classes, cx, theme } = useStyles()
    const account = useAccount()

    const { data, isFetching, fetchNextPage } = useInfiniteQuery({
        queryKey: ['friend-tech', 'holdings', address],
        queryFn: async ({ pageParam: nextIndicator }) => {
            return FriendTech.getHolding(address, nextIndicator)
        },
        getNextPageParam: (x) => x.nextIndicator,
    })
    const holdings = useMemo(() => {
        if (!data?.pages.length) return EMPTY_LIST
        // There could be duplicate users.
        return uniqBy(
            data.pages.flatMap((x) => x.data),
            (x) => x.address,
        )
    }, [data?.pages])

    if (!isFetching && !holdings.length) {
        const noKeysContext = isSameAddress(address, account) ? 'mine' : 'other'
        return (
            <div {...rest} className={cx(classes.container, rest.className)}>
                <Box flexGrow={1} display="flex" alignItems="center" justifyContent="center">
                    <Typography color={theme.palette.maskColor.second} fontSize={14}>
                        <Translate.no_keys
                            values={{ context: noKeysContext }}
                            context={noKeysContext}
                            components={{
                                a: (
                                    <Link
                                        color={theme.palette.maskColor.main}
                                        href="https://www.friend.tech/explore"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    />
                                ),
                            }}
                        />
                    </Typography>
                </Box>
            </div>
        )
    }

    return (
        <div {...rest} className={cx(classes.container, rest.className)}>
            <div className={classes.holdings}>
                {holdings.map((holding) => (
                    <HoldingCard
                        key={holding.address}
                        holding={holding}
                        holder={address}
                        className={classes.holdingCard}
                    />
                ))}
                {isFetching ? range(4).map((i) => <HoldingCardSkeleton key={i} />) : null}
            </div>
            <ElementAnchor callback={() => fetchNextPage()} key={holdings.length} height={10} />
        </div>
    )
})
