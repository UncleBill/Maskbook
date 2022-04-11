import type { NetworkPluginID } from '../web3-types'
import { useChainId } from './useChainId'
import { useWeb3State } from './useWeb3State'

export function useChainDetailed(pluginID?: NetworkPluginID) {
    const chainId = useChainId(pluginID)
    const { Utils } = useWeb3State(pluginID)
    return Utils?.getChainDetailed?.(chainId) ?? null
}
