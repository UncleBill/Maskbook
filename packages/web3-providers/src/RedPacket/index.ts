import urlcat from 'urlcat'
import { mapKeys } from 'lodash-es'
import type { AbiItem } from 'web3-utils'
import { createIndicator, createPageable, type PageIndicator, type Pageable, EMPTY_LIST } from '@masknet/shared-base'
import { type Transaction, attemptUntil, type NonFungibleCollection } from '@masknet/web3-shared-base'
import { decodeFunctionData, type ChainId, type SchemaType } from '@masknet/web3-shared-evm'
import REDPACKET_ABI from '@masknet/web3-contracts/abis/HappyRedPacketV4.json'
import NFT_REDPACKET_ABI from '@masknet/web3-contracts/abis/NftRedPacket.json'
import { DSEARCH_BASE_URL } from '../DSearch/constants.js'
import { fetchFromDSearch } from '../DSearch/helpers.js'
import { ChainbaseRedPacket } from '../Chainbase/index.js'
import { EtherscanRedPacket } from '../Etherscan/index.js'
import { ContractRedPacket } from './api.js'
import {
    type RedPacketJSONPayloadFromChain,
    type NftRedPacketJSONPayload,
    type CreateNFTRedpacketParam,
} from './types.js'
import { EVMChainResolver } from '../Web3/EVM/apis/ResolverAPI.js'
import type { BaseHubOptions, RedPacketBaseAPI } from '../entry-types.js'

class RedPacketAPI implements RedPacketBaseAPI.Provider<ChainId, SchemaType> {
    getHistories(
        chainId: ChainId,
        senderAddress: string,
        contractAddress: string,
        methodId: string,
        fromBlock: number,
        endBlock: number,
    ): Promise<RedPacketJSONPayloadFromChain[] | undefined> {
        return attemptUntil(
            [
                async () => {
                    const transactions = await this.getHistoryTransactions(
                        chainId,
                        senderAddress,
                        contractAddress,
                        methodId,
                        fromBlock,
                        endBlock,
                    )
                    return this.parseRedPacketCreationTransactions(transactions, senderAddress)
                },
                () => {
                    // block range might be too large
                    return ContractRedPacket.getHistories(
                        chainId,
                        senderAddress,
                        contractAddress,
                        methodId,
                        fromBlock,
                        endBlock,
                    )
                },
            ],
            [],
        )
    }

    async getNFTHistories(
        chainId: ChainId,
        senderAddress: string,
        contractAddress: string,
        methodId: string,
        fromBlock: number,
        endBlock: number,
    ): Promise<NftRedPacketJSONPayload[] | undefined> {
        return this.parseNFTRedPacketCreationTransactions(
            await this.getHistoryTransactions(chainId, senderAddress, contractAddress, methodId, fromBlock, endBlock),
            senderAddress,
        )
    }

    async getHistoryTransactions(
        chainId: ChainId,
        senderAddress: string,
        contractAddress: string,
        methodId: string,
        fromBlock: number,
        endBlock: number,
    ) {
        return attemptUntil(
            [
                () => {
                    return ChainbaseRedPacket.getHistoryTransactions(chainId, senderAddress, contractAddress, methodId)
                },
                () => {
                    return EtherscanRedPacket.getHistoryTransactions(
                        chainId,
                        senderAddress,
                        contractAddress,
                        methodId,
                        fromBlock,
                        endBlock,
                    )
                },
            ],
            [],
        )
    }

    async getCollectionsByOwner(
        account: string,
        { chainId, indicator }: BaseHubOptions<ChainId> = {},
    ): Promise<Pageable<NonFungibleCollection<ChainId, SchemaType>, PageIndicator>> {
        const result = await fetchFromDSearch<{
            [owner: string]: Array<NonFungibleCollection<ChainId, SchemaType>>
        }>(urlcat(DSEARCH_BASE_URL, '/nft-lucky-drop/specific-list.json'))
        const list = mapKeys(result, (_v, k) => k.toLowerCase())?.[account.toLowerCase()].filter(
            (x) => x.chainId === chainId,
        )
        return createPageable(list, createIndicator(indicator))
    }

    private parseNFTRedPacketCreationTransactions(
        transactions: Array<Transaction<ChainId, SchemaType>> | undefined,
        senderAddress: string,
    ): NftRedPacketJSONPayload[] {
        if (!transactions) return EMPTY_LIST

        return transactions.flatMap((tx) => {
            try {
                const decodedInputParam = decodeFunctionData(
                    NFT_REDPACKET_ABI as AbiItem[],
                    tx.input ?? '',
                    'create_red_packet',
                ) as CreateNFTRedpacketParam

                const redpacketPayload: NftRedPacketJSONPayload = {
                    contract_address: tx.to,
                    txid: tx.hash ?? '',
                    contract_version: 1,
                    shares: decodedInputParam._erc721_token_ids.length,
                    network: EVMChainResolver.networkType(tx.chainId),
                    token_address: decodedInputParam._token_addr,
                    chainId: tx.chainId,
                    sender: {
                        address: senderAddress,
                        name: decodedInputParam._name,
                        message: decodedInputParam._message,
                    },
                    duration: decodedInputParam._duration.toNumber() * 1000,
                    token_ids: decodedInputParam._erc721_token_ids.map((x) => x.toString()),
                    // #region Retrieve at NFT History List Item.
                    rpid: '',
                    creation_time: 0,
                    // #endregion
                    // #region Retrieve from database
                    password: '',
                    // #endregion
                }

                return redpacketPayload
            } catch {
                return EMPTY_LIST
            }
        })
    }

    private parseRedPacketCreationTransactions(
        transactions: Array<Transaction<ChainId, SchemaType>> | undefined,
        senderAddress: string,
    ): RedPacketJSONPayloadFromChain[] {
        if (!transactions) return EMPTY_LIST

        return transactions.flatMap((tx) => {
            try {
                const decodedInputParam = decodeFunctionData(
                    REDPACKET_ABI as AbiItem[],
                    tx.input ?? '',
                    'create_red_packet',
                )

                const redpacketPayload: RedPacketJSONPayloadFromChain = {
                    contract_address: tx.to,
                    txid: tx.hash ?? '',
                    chainId: tx.chainId,
                    shares: decodedInputParam._number.toNumber(),
                    is_random: decodedInputParam._ifrandom,
                    total: decodedInputParam._total_tokens.toString(),
                    duration: decodedInputParam._duration.toNumber() * 1000,
                    block_number: Number(tx.blockNumber),
                    contract_version: 4,
                    network: EVMChainResolver.networkType(tx.chainId),
                    token_address: decodedInputParam._token_addr,
                    sender: {
                        address: senderAddress,
                        name: decodedInputParam._name,
                        message: decodedInputParam._message,
                    },
                    // #region Retrieve at RedPacketInHistoryList component
                    rpid: '',
                    creation_time: 0,
                    total_remaining: '',
                    // #endregion
                    // #region Retrieve from database
                    password: '',
                    // #endregion
                }
                return redpacketPayload
            } catch {
                return EMPTY_LIST
            }
        })
    }
}
export const RedPacket = new RedPacketAPI()
