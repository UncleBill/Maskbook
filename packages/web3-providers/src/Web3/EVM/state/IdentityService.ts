import { compact, uniqBy } from 'lodash-es'
import type { WalletAPI } from '../../../entry-types.js'
import {
    EMPTY_LIST,
    NetworkPluginID,
    NextIDPlatform,
    PluginID,
    SocialAddressType,
    createLookupTableResolver,
    type BindingProof,
    type SocialAddress,
    type SocialIdentity,
    Sniffings,
} from '@masknet/shared-base'
import { ChainId, isValidAddress, isZeroAddress } from '@masknet/web3-shared-evm'
import { IdentityServiceState } from '../../Base/state/IdentityService.js'
import { EVMWeb3Readonly } from '../apis/ConnectionReadonlyAPI.js'
import { BaseMaskX } from '../../../entry-types.js'
import { ARBID } from '../../../ARBID/index.js'
import { ENS } from '../../../ENS/index.js'
import { Firefly } from '../../../Firefly/index.js'
import { Lens } from '../../../Lens/index.js'
import { MaskX } from '../../../MaskX/index.js'
import { NextIDProof } from '../../../NextID/proof.js'
import { RSS3 } from '../../../RSS3/index.js'
import { SpaceID } from '../../../SpaceID/index.js'
import { Twitter } from '../../../Twitter/index.js'
import { NextIDStorageProvider } from '../../../NextID/kv.js'

const ENS_RE = /[^\s()[\]]{1,256}\.(eth|kred|xyz|luxe)\b/gi
const SID_RE = /[^\s()[\]]{1,256}\.bnb\b/gi
const ARBID_RE = /[^\s()[\]]{1,256}\.arb\b/gi
const ADDRESS_FULL = /0x\w{40,}/i
const CROSSBELL_HANDLE_RE = /[\w.]+\.csb/gi
const LENS_RE = /[^\s()[\]]{1,256}\.lens\b/i
const LENS_URL_RE = /https?:\/\/.+\/(\w+\.lens)/

function getENSNames(userId: string, nickname: string, bio: string) {
    return [userId.match(ENS_RE), nickname.match(ENS_RE), bio.match(ENS_RE)].flatMap((result) => result ?? [])
}

function getLensNames(nickname: string, bio: string, homepage: string) {
    const homepageNames = homepage.match(LENS_URL_RE)?.[1]
    const names = [nickname.match(LENS_RE), bio.match(LENS_RE)].map((result) => result?.[0] ?? '')
    return [...names, homepageNames].filter(Boolean) as string[]
}

function getARBIDNames(userId: string, nickname: string, bio: string) {
    return [userId.match(ARBID_RE), nickname.match(ARBID_RE), bio.match(ARBID_RE)].flatMap((result) => result ?? [])
}

function getSIDNames(userId: string, nickname: string, bio: string) {
    return [userId.match(SID_RE), nickname.match(SID_RE), bio.match(SID_RE)]
        .flatMap((result) => result || [])
        .map((x) => x.toLowerCase())
}

function getCrossBellHandles(nickname: string, bio: string) {
    return [nickname.match(CROSSBELL_HANDLE_RE), bio.match(CROSSBELL_HANDLE_RE)]
        .flatMap((result) => result || [])
        .map((x) => x.toLowerCase())
}

function getAddress(text: string) {
    const [matched] = text.match(ADDRESS_FULL) ?? []
    if (matched && isValidAddress(matched)) return matched
    return
}

function getNextIDPlatform() {
    if (Sniffings.is_twitter_page) return NextIDPlatform.Twitter
    return
}

async function getWalletAddressesFromNextID({ identifier, publicKey }: SocialIdentity): Promise<BindingProof[]> {
    if (!identifier?.userId) return EMPTY_LIST

    const platform = getNextIDPlatform()
    if (!platform) return EMPTY_LIST

    const latestActivatedBinding = await NextIDProof.queryLatestBindingByPlatform(
        platform,
        identifier.userId,
        publicKey,
    )
    if (!latestActivatedBinding) return EMPTY_LIST
    return latestActivatedBinding.proofs.filter(
        (x) => x.platform === NextIDPlatform.Ethereum && isValidAddress(x.identity),
    )
}

const resolveMaskXAddressType = createLookupTableResolver<BaseMaskX.SourceType, SocialAddressType>(
    {
        [BaseMaskX.SourceType.CyberConnect]: SocialAddressType.CyberConnect,
        [BaseMaskX.SourceType.Firefly]: SocialAddressType.Firefly,
        [BaseMaskX.SourceType.HandWriting]: SocialAddressType.Firefly,
        [BaseMaskX.SourceType.Leaderboard]: SocialAddressType.Leaderboard,
        [BaseMaskX.SourceType.OpenSea]: SocialAddressType.OpenSea,
        [BaseMaskX.SourceType.Sybil]: SocialAddressType.Sybil,
        [BaseMaskX.SourceType.Uniswap]: SocialAddressType.Sybil,
        [BaseMaskX.SourceType.RSS3]: SocialAddressType.RSS3,
        [BaseMaskX.SourceType.TwitterHexagon]: SocialAddressType.TwitterBlue,
    },
    (x) => {
        throw new Error(`Unknown source type: ${x}`)
    },
)

export class EVMIdentityService extends IdentityServiceState<ChainId> {
    constructor(protected context: WalletAPI.IOContext) {
        super()
    }

    private createSocialAddress(
        type: SocialAddressType,
        address: string,
        label = '',
        chainId?: ChainId,
        updatedAt?: string,
        createdAt?: string,
        verified?: boolean,
    ): SocialAddress<ChainId> | undefined {
        if (isValidAddress(address) && !isZeroAddress(address)) {
            return {
                pluginID: NetworkPluginID.PLUGIN_EVM,
                chainId,
                type,
                label,
                address,
                updatedAt,
                createdAt,
                verified,
            }
        }
        return
    }

    /** Read a social address from bio. */
    private async getSocialAddressFromBio({ bio = '' }: SocialIdentity) {
        const address = getAddress(bio)
        if (!address) return
        return this.createSocialAddress(SocialAddressType.Address, address)
    }

    /** Read a social address from bio when it contains a csb handle. */
    private async getSocialAddressFromCrossbell({ nickname = '', bio = '' }: SocialIdentity) {
        const handles = getCrossBellHandles(nickname, bio)
        if (!handles.length) return

        const allSettled = await Promise.allSettled(
            handles.map(async (handle) => {
                const info = await RSS3.getNameInfo(handle)
                if (!info?.crossbell) return
                return this.createSocialAddress(SocialAddressType.Crossbell, info.address, info.crossbell)
            }),
        )
        return compact(allSettled.map((x) => (x.status === 'fulfilled' ? x.value : undefined)))
    }

    /** Read a social address from avatar NextID storage. */
    private async getSocialAddressFromAvatarNextID({ identifier, publicKey }: SocialIdentity) {
        const userId = identifier?.userId
        if (!userId || !publicKey) return

        const response = await NextIDStorageProvider.getByIdentity<{ ownerAddress?: string }>(
            publicKey,
            NextIDPlatform.Twitter,
            userId.toLowerCase(),
            PluginID.Avatar,
        )

        if (!response.isOk() || !response.value.ownerAddress) return
        return this.createSocialAddress(SocialAddressType.Mask, response.value.ownerAddress)
    }

    /** Read a social address from NextID. */
    private async getSocialAddressesFromNextID(identity: SocialIdentity) {
        const listOfAddress = await getWalletAddressesFromNextID(identity)
        return compact(
            listOfAddress.map((x) =>
                this.createSocialAddress(
                    SocialAddressType.NEXT_ID,
                    x.identity,
                    '',
                    undefined,
                    x.latest_checked_at,
                    x.created_at,
                ),
            ),
        )
    }

    /** Read a social address from nickname, bio if them contain a ENS. */
    private async getSocialAddressFromENS({ identifier, nickname = '', bio = '' }: SocialIdentity) {
        const names = getENSNames(identifier?.userId ?? '', nickname, bio)
        if (!names.length) return

        const allSettled = await Promise.allSettled(
            names.map(async (name) => {
                const address = await ENS.lookup(name)
                if (!address) return
                return [
                    this.createSocialAddress(SocialAddressType.ENS, address, name),
                    this.createSocialAddress(SocialAddressType.Address, address, name),
                ]
            }),
        )
        return compact(allSettled.flatMap((x) => (x.status === 'fulfilled' ? x.value : undefined)))
    }

    private async getSocialAddressFromARBID({ identifier, nickname = '', bio = '' }: SocialIdentity) {
        const names = getARBIDNames(identifier?.userId ?? '', nickname, bio)
        if (!names.length) return

        const allSettled = await Promise.allSettled(
            names.map(async (name) => {
                const address = await ARBID.lookup(name)
                if (!address) return
                return [
                    this.createSocialAddress(SocialAddressType.ARBID, address, name, ChainId.Arbitrum),
                    this.createSocialAddress(SocialAddressType.Address, address, name, ChainId.Arbitrum),
                ]
            }),
        )
        return compact(allSettled.flatMap((x) => (x.status === 'fulfilled' ? x.value : undefined)))
    }

    private async getSocialAddressFromSpaceID({ identifier, nickname = '', bio = '' }: SocialIdentity) {
        const names = getSIDNames(identifier?.userId ?? '', nickname, bio)
        if (!names.length) return

        const allSettled = await Promise.allSettled(
            names.map(async (name) => {
                const address = await SpaceID.lookup(name)
                if (!address) return
                return [
                    this.createSocialAddress(SocialAddressType.SPACE_ID, address, name, ChainId.BSC),
                    this.createSocialAddress(SocialAddressType.Address, address, name, ChainId.BSC),
                ]
            }),
        )
        return compact(allSettled.flatMap((x) => (x.status === 'fulfilled' ? x.value : undefined)))
    }

    private async getSocialAddressFromLens({ nickname = '', bio = '', homepage = '' }: SocialIdentity) {
        const names = getLensNames(nickname, bio, homepage)
        if (!names.length) return

        const allSettled = await Promise.allSettled(
            names.map(async (name) => {
                const profile = await Lens.getProfileByHandle(name)
                if (!profile) return
                return [
                    this.createSocialAddress(SocialAddressType.Lens, profile.ownedBy.address, name),
                    this.createSocialAddress(SocialAddressType.Address, profile.ownedBy.address, name),
                ]
            }),
        )
        return compact(allSettled.flatMap((x) => (x.status === 'fulfilled' ? x.value : undefined)))
    }

    /** Read a social address from Twitter Blue. */
    private async getSocialAddressFromTwitterBlue({ identifier }: SocialIdentity) {
        const userId = identifier?.userId
        if (!userId) return

        const response = await Twitter.getUserNftContainer(userId)
        if (!response) return
        const ownerAddress = await EVMWeb3Readonly.getNonFungibleTokenOwner(
            response.address,
            response.token_id,
            undefined,
            {
                chainId: ChainId.Mainnet,
            },
        )
        if (!ownerAddress || !isValidAddress(ownerAddress)) return
        return this.createSocialAddress(
            SocialAddressType.TwitterBlue,
            ownerAddress,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
        )
    }

    /** Read social addresses from MaskX */
    private async getSocialAddressesFromMaskX({ identifier }: SocialIdentity) {
        const userId = identifier?.userId
        if (!userId) return

        const response = await MaskX.getIdentitiesExact(userId, BaseMaskX.PlatformType.Twitter)
        const results = response.records.filter((x) => {
            if (!isValidAddress(x.web3_addr) || !x.is_verified) return false

            try {
                // detect if a valid data source
                resolveMaskXAddressType(x.source)
                return true
            } catch {
                return false
            }
        })

        const allSettled = await Promise.allSettled(
            results.map(async (y) => {
                try {
                    const name = await ENS.reverse(y.web3_addr)

                    return this.createSocialAddress(resolveMaskXAddressType(y.source), y.web3_addr, name)
                } catch {
                    return this.createSocialAddress(resolveMaskXAddressType(y.source), y.web3_addr)
                }
            }),
        )
        return compact(allSettled.map((x) => (x.status === 'fulfilled' ? x.value : undefined)))
    }

    override async getFromRemote(identity: SocialIdentity, includes?: SocialAddressType[]) {
        const socialAddressFromMaskX = this.getSocialAddressesFromMaskX(identity)
        const socialAddressFromNextID = this.getSocialAddressesFromNextID(identity)
        const allSettled = await Promise.allSettled([
            this.getSocialAddressFromBio(identity),
            this.getSocialAddressFromENS(identity),
            this.getSocialAddressFromSpaceID(identity),
            this.getSocialAddressFromARBID(identity),
            this.getSocialAddressFromAvatarNextID(identity),
            this.getSocialAddressFromCrossbell(identity),
            this.getSocialAddressFromTwitterBlue(identity),
            socialAddressFromNextID,
            socialAddressFromMaskX,
            this.getSocialAddressFromLens(identity),
        ])
        const identities_ = compact(allSettled.flatMap((x) => (x.status === 'fulfilled' ? x.value : [])))

        const identities = uniqBy(identities_, (x) => [x.type, x.label, x.address.toLowerCase()].join('_'))
        const identitiesFromNextID = await socialAddressFromNextID

        const handle = identity.identifier?.userId
        const verifiedResult = await Promise.allSettled(
            uniqBy(identities, (x) => x.address.toLowerCase()).map(async (x) => {
                const address = x.address.toLowerCase()
                if (x.verified) return address
                const isReliable = await Firefly.verifyTwitterHandleByAddress(address, handle)
                return isReliable ? address : null
            }),
        )
        const trustedAddresses = compact(verifiedResult.map((x) => (x.status === 'fulfilled' ? x.value : null)))

        return identities
            .filter((x) => trustedAddresses.includes(x.address.toLowerCase()) || x.type === SocialAddressType.Address)
            .concat(identitiesFromNextID)
    }
}
