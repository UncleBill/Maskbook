import { EMPTY_LIST, type Pageable, createPageable, createIndicator } from '@masknet/shared-base'
import { attemptUntil, type Transaction as Web3Transaction } from '@masknet/web3-shared-base'
import { ChainId, type GasOption, type SchemaType } from '@masknet/web3-shared-evm'
import { EVMChainResolver } from './ResolverAPI.js'
import { BaseHubProvider } from '../../Base/apis/HubBase.js'
import { GasOptions } from './GasOptionAPI.js'
import { EVMHubOptionsProvider } from './HubOptionsAPI.js'
import type { EVMHubOptions } from '../types/index.js'
import { MetaSwap } from '../../../MetaSwap/index.js'
import { AstarGas } from '../../../Astar/index.js'
import { DeBankGasOption, DeBankHistory } from '../../../DeBank/index.js'
import { Zerion } from '../../../Zerion/index.js'

export class EVMBaseHub extends BaseHubProvider<ChainId, SchemaType, GasOption> {
    protected override HubOptions = new EVMHubOptionsProvider(this.options)

    async getGasOptions(chainId: ChainId, initial?: EVMHubOptions) {
        const options = this.HubOptions.fill({
            ...initial,
            chainId,
        })
        try {
            const isEIP1559 = EVMChainResolver.isFeatureSupported(options.chainId, 'EIP1559')
            if (isEIP1559 && chainId !== ChainId.Astar) return await MetaSwap.getGasOptions(options.chainId)
            if (chainId === ChainId.Aurora) return GasOptions.getGasOptions(options.chainId)
            if (chainId === ChainId.Astar) return await AstarGas.getGasOptions()
            return await DeBankGasOption.getGasOptions(options.chainId)
        } catch (error) {
            return GasOptions.getGasOptions(options.chainId)
        }
    }

    async getTransactions(
        chainId: ChainId,
        account: string,
        initial?: EVMHubOptions,
    ): Promise<Pageable<Web3Transaction<ChainId, SchemaType>>> {
        const options = this.HubOptions.fill({
            ...initial,
            account,
            chainId,
        })
        return attemptUntil(
            [DeBankHistory, Zerion].map((x) => () => x.getTransactions(options.account, options)),
            createPageable(EMPTY_LIST, createIndicator(options.indicator)),
        )
    }
}
