import type { AsyncStateRetry } from 'react-use/lib/useAsyncRetry.js'
import type { TraderAPI } from '@masknet/web3-providers/types'
import { multipliedBy, pow10 } from '@masknet/web3-shared-base'
import { useChainContext } from '@masknet/web3-hooks-base'
import type { Web3Helper } from '@masknet/web3-helpers'
import { TradeProvider } from '@masknet/public-api'
import { useTrade as useNativeTokenTrade } from './native/useTrade.js'
import { useUniswapV2Like } from './useUniswapV2Like.js'
import { useAvailableTraderProviders } from '../trending/useAvailableTraderProviders.js'
import { useUniswapV3Like } from './useUniSwapV3Like.js'
import { useZeroX } from './useZeroX.js'
import { useOpenOcean } from './useOpenOcean.js'
import { useBancor } from './useBancor.js'

export function useAllTradeComputed(
    inputAmount: string,
    scale: number,
    inputToken?: Web3Helper.FungibleTokenAll,
    outputToken?: Web3Helper.FungibleTokenAll,
    temporarySlippage?: number,
) {
    const { chainId } = useChainContext()
    const inputTokenProduct = pow10(inputToken?.decimals ?? 0)
    const inputAmount_ = multipliedBy(inputAmount || '0', inputTokenProduct)
        .integerValue()
        .toFixed()
    const tradeProviders = useAvailableTraderProviders(chainId)

    // NATIVE-WNATIVE pair
    const { value: isNativeTokenWrapper } = useNativeTokenTrade(inputToken, outputToken)

    // uniswap-v2
    const uniswapV2 = useUniswapV2Like(
        TradeProvider.UNISWAP_V2,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // sushi swap
    const sushiSwap = useUniswapV2Like(
        TradeProvider.SUSHISWAP,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // quick swap
    const quickSwap = useUniswapV2Like(
        TradeProvider.QUICKSWAP,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )
    // pancake swap
    const pancakeSwap = useUniswapV2Like(
        TradeProvider.PANCAKESWAP,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // uniswap-v3 like providers
    const uniswapV3 = useUniswapV3Like(
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // zrx
    const zrx = useZeroX(inputAmount_, scale, inputToken, outputToken, temporarySlippage, isNativeTokenWrapper)

    // bancor
    const bancor = useBancor(inputAmount_, scale, inputToken, outputToken, temporarySlippage, isNativeTokenWrapper)
    // traderjoe

    const traderJoe = useUniswapV2Like(
        TradeProvider.TRADERJOE,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // pangolindex
    const pangolindex = useUniswapV2Like(
        TradeProvider.PANGOLIN,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )
    // openocean
    const openocean = useOpenOcean(
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // trisolaris
    const trisolaris = useUniswapV2Like(
        TradeProvider.TRISOLARIS,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // WannaSwap
    const wannaswap = useUniswapV2Like(
        TradeProvider.WANNASWAP,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )
    // Mdex
    const mdex = useUniswapV2Like(
        TradeProvider.MDEX,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    // Arthswap
    const arthswap = useUniswapV2Like(
        TradeProvider.ARTHSWAP,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )
    // Versa Finance
    const versa = useUniswapV2Like(
        TradeProvider.VERSA,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )
    // Astar Exchange
    const astarexchange = useUniswapV2Like(
        TradeProvider.ASTAREXCHANGE,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )
    // Yumi Swap
    const yumiswap = useUniswapV2Like(
        TradeProvider.YUMISWAP,
        inputAmount_,
        scale,
        inputToken,
        outputToken,
        temporarySlippage,
        isNativeTokenWrapper,
    )

    const all: Array<AsyncStateRetry<TraderAPI.TradeInfo | null | undefined>> = [
        uniswapV2,
        sushiSwap,
        quickSwap,
        pancakeSwap,
        uniswapV3,
        zrx,
        traderJoe,
        bancor,
        pangolindex,
        openocean,
        wannaswap,
        trisolaris,
        mdex,
        arthswap,
        versa,
        astarexchange,
        yumiswap,
    ]

    return all.filter((x) => {
        return tradeProviders.some((provider) => provider === x.value?.provider) && !!x.value
    }) as Array<AsyncStateRetry<TraderAPI.TradeInfo>>
}
