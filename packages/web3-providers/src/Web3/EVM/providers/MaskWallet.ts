import { compact, debounce, first, isEqual, sortBy, uniqWith } from 'lodash-es'
import {
    createSubscriptionFromValueRef,
    CrossIsolationMessages,
    type Wallet,
    type ECKeyIdentifier,
    EMPTY_LIST,
    ExtensionSite,
    ValueRef,
    ImportSource,
    getExtensionSiteType,
} from '@masknet/shared-base'
import { isSameAddress } from '@masknet/web3-shared-base'
import { ChainId, isValidAddress, PayloadEditor, ProviderType, type RequestArguments } from '@masknet/web3-shared-evm'
import { EVMChainResolver } from '../apis/ResolverAPI.js'
import { BaseEIP4337WalletProvider } from './BaseContractWallet.js'
import { EVMRequestReadonly } from '../apis/RequestReadonlyAPI.js'
import { SmartPayOwner } from '../../../SmartPay/apis/OwnerAPI.js'
import type { WalletAPI } from '../../../entry-types.js'
import { evm } from '../../../Manager/registry.js'

export class MaskWalletProvider extends BaseEIP4337WalletProvider {
    private ref = new ValueRef<Wallet[]>(EMPTY_LIST)
    protected override async io_renameWallet(address: string, name: string): Promise<void> {
        await this.context?.MaskWalletContext?.renameWallet(address, name)
    }
    constructor() {
        super(ProviderType.MaskWallet)
    }

    async updateImmediately() {
        const wallets = this.context?.wallets.getCurrentValue() ?? EMPTY_LIST

        // update local wallets immediately
        this.ref.value = sortBy(
            uniqWith([...super.wallets, ...wallets], (a, b) => isSameAddress(a.address, b.address)),
            (x) => !!x.owner,
        )
    }

    async update() {
        // Fetching info of SmartPay wallets is slow, update provider wallets eagerly here.
        await this.updateImmediately()

        const allPersonas = this.context?.MaskWalletContext?.allPersonas.getCurrentValue() ?? EMPTY_LIST
        const wallets = this.context?.wallets.getCurrentValue() ?? EMPTY_LIST

        const chainId = await this.Bundler.getSupportedChainId()
        const accounts = await SmartPayOwner.getAccountsByOwners(chainId, [
            ...wallets.map((x) => x.address),
            ...compact(allPersonas.map((x) => x.address)),
        ])

        const now = new Date()
        const smartPayWallets = accounts
            .filter((x) => x.deployed)
            .map((x) => ({
                id: x.address,
                name: super.wallets.find((item) => isSameAddress(item.address, x.address))?.name ?? 'Smart Pay',
                source: ImportSource.WalletRPC,
                address: x.address,
                hasDerivationPath: false,
                hasStoredKeyInfo: false,
                configurable: true,
                createdAt: now,
                updatedAt: now,
                owner: x.owner,
                deployed: x.deployed,
                identifier: allPersonas.find((persona) => isSameAddress(x.owner, persona.address))?.identifier.toText(),
            }))

        const result = uniqWith([...smartPayWallets, ...super.wallets, ...wallets], (a, b) =>
            isSameAddress(a.address, b.address),
        )

        if (!isEqual(result, super.wallets)) {
            await this.updateWallets(result)
        }
        this.ref.value = sortBy(result, (x) => !!x.owner)
    }

    override get subscription() {
        return {
            ...super.subscription,
            wallets: createSubscriptionFromValueRef(this.ref),
        }
    }

    override get wallets() {
        return this.subscription.wallets.getCurrentValue()
    }

    override async setup(context?: WalletAPI.IOContext) {
        await super.setup(context)

        this.subscription?.wallets?.subscribe(async () => {
            const primaryWallet = first(this.wallets)
            const smartPayChainId = await this.Bundler.getSupportedChainId()
            if (!this.hostedAccount && primaryWallet) {
                await this.switchAccount(primaryWallet.address)
                await this.switchChain(primaryWallet.owner ? smartPayChainId : ChainId.Mainnet)
                if (primaryWallet.owner) {
                    const networks = evm.state?.Network?.networks?.getCurrentValue()
                    const target = networks?.find((x) => x.chainId === smartPayChainId)
                    if (target) evm.state?.Network?.switchNetwork(target.ID)
                }
            }
        })

        await this.updateImmediately()

        const debounceUpdate = debounce(this.update.bind(this), 1000)

        this.context?.wallets.subscribe(debounceUpdate)
        this.context?.MaskWalletContext?.allPersonas.subscribe(debounceUpdate)
        CrossIsolationMessages.events.renameWallet.on(debounceUpdate)
    }

    override async addWallet(wallet: Wallet): Promise<void> {
        if (!this.hostedAccount && !this.wallets.length) await this.walletStorage?.account.setValue(wallet.address)
        await this.context?.addWallet(ImportSource.WalletRPC, wallet.address, wallet)
    }

    override async removeWallet(address: string, password?: string | undefined): Promise<void> {
        const scWallets = this.wallets.filter((x) => isSameAddress(x.owner, address))
        if (scWallets.length) await super.removeWallets(scWallets)
        if (isSameAddress(this.hostedAccount, address)) await this.walletStorage?.account.setValue('')
        await super.removeWallet(address, password)
        await this.context?.MaskWalletContext?.removeWallet(address, password)
    }

    override async removeWallets(wallets: Wallet[]): Promise<void> {
        await super.removeWallets(wallets)
        for (const wallet of wallets) {
            if (isSameAddress(this.hostedAccount, wallet.address)) await this.walletStorage?.account.setValue('')
            if (!wallet.owner) await this.context?.MaskWalletContext?.removeWallet(wallet.address)
        }
    }

    override async resetAllWallets(): Promise<void> {
        await super.removeWallets(this.wallets)
        await this.walletStorage?.account.setValue('')
        await this.context?.MaskWalletContext?.resetAllWallets()
    }

    override async renameWallet(address: string, name: string) {
        await super.renameWallet(address, name)
        CrossIsolationMessages.events.renameWallet.sendToAll({})
    }

    override async connect(
        chainId: ChainId,
        address?: string,
        owner?: {
            account: string
            identifier?: ECKeyIdentifier
        },
        silent?: boolean,
        externalRequestID?: string | null,
    ) {
        if (getExtensionSiteType() === ExtensionSite.Popup || silent) {
            if (isValidAddress(address)) {
                await this.switchAccount(address, owner)
                await this.switchChain(chainId)

                if (externalRequestID) {
                    await this.context?.grantEIP2255Permission(externalRequestID, [address])
                }

                return {
                    account: address,
                    chainId,
                }
            }

            return {
                account: this.hostedAccount,
                chainId: this.hostedChainId,
            }
        }

        if (externalRequestID)
            throw new TypeError(
                'externalRequestID is not expected in MaskWalletProvider.connect() when the page is not popup page.',
            )

        const account = first(await this.context?.selectMaskWalletAccount(chainId, address, location.origin))
        if (!account) throw new Error(`Failed to connect to ${EVMChainResolver.chainFullName(chainId)}`)

        // switch account
        if (!isSameAddress(this.hostedAccount, account?.address)) {
            await this.switchAccount(
                account.address,
                account.owner ?
                    {
                        account: account.owner,
                        identifier: account.identifier,
                    }
                :   undefined,
            )
        }

        // switch chain
        if (chainId !== this.hostedChainId) await this.switchChain(chainId)
        return {
            chainId,
            account: account.address,
        }
    }

    override async disconnect() {
        await this.context?.disconnectAllWalletsFromOrigin(location.origin)
    }

    override async request<T>(
        requestArguments: RequestArguments,
        initial?: WalletAPI.ProviderOptions<ChainId>,
    ): Promise<T> {
        return EVMRequestReadonly.request<T>(
            PayloadEditor.fromMethod(requestArguments.method, requestArguments.params).fill() as RequestArguments,
            initial,
        )
    }
}
