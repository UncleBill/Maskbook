import type { RSS3Account, RSS3Asset } from 'rss3-next/types/rss3'
import type { GeneralAsset, GeneralAssetWithTags } from './types'
import config from './config'
import RSS3, { IRSS3 } from './rss3'

const orderPattern = new RegExp(`^${config.tags.prefix}:order:(-?\\d+)$`, 'i')

type TypesWithTag = RSS3Account | GeneralAssetWithTags

const getTaggedOrder = (tagged: TypesWithTag): number => {
    if (!tagged.tags) {
        return -1
    }
    for (const tag of tagged.tags) {
        if (orderPattern.test(tag)) {
            return Number.parseInt(orderPattern.exec(tag)?.[1] || '-1', 10)
        }
    }
    return -1
}

const setTaggedOrder = (tagged: TypesWithTag, order?: number): void => {
    if (!tagged.tags) {
        tagged.tags = []
    } else {
        const oldIndex = tagged.tags.findIndex((tag) => orderPattern.test(tag))
        if (oldIndex !== -1) {
            tagged.tags.splice(oldIndex, 1)
        }
    }
    if (order) {
        tagged.tags.push(`${config.tags.prefix}:order:${order}`)
    } else {
        tagged.tags.push(`${config.tags.prefix}:${config.tags.hiddenTag}`)
    }
}

function sortByOrderTag<T extends TypesWithTag>(taggedList: T[]): T[] {
    taggedList.sort((a, b) => {
        return getTaggedOrder(a) - getTaggedOrder(b)
    })
    return taggedList
}

const setOrderTag = async (taggedList: TypesWithTag[]): Promise<TypesWithTag[]> => {
    await Promise.all(
        taggedList.map(async (tagged, index) => {
            setTaggedOrder(tagged, index)
        }),
    )
    return taggedList
}

const setHiddenTag = async (taggedList: TypesWithTag[]): Promise<TypesWithTag[]> => {
    await Promise.all(
        taggedList.map(async (tagged) => {
            setTaggedOrder(tagged)
        }),
    )
    return taggedList
}

const mergeAssetsTags = async (assetsInRSS3File: RSS3Asset[], assetsGrabbed: GeneralAsset[]) => {
    return Promise.all(
        (assetsGrabbed || []).map(async (asset: GeneralAssetWithTags) => {
            const origType = asset.type
            if (config.hideUnlistedAssets) {
                asset.type = 'Invalid' // Using as a match mark
            }
            for (const assetInRSS3 of assetsInRSS3File) {
                if (
                    assetInRSS3.platform === asset.platform &&
                    assetInRSS3.identity === asset.identity &&
                    assetInRSS3.id === asset.id &&
                    assetInRSS3.type === origType
                ) {
                    // Matched
                    asset.type = origType // Recover type
                    if (assetInRSS3.tags) {
                        asset.tags = assetInRSS3.tags
                    }
                    break
                }
            }
            return asset
        }),
    )
}

interface AssetsList {
    listed: GeneralAssetWithTags[]
    unlisted: GeneralAssetWithTags[]
}

async function initAssets(type: string, limit?: number) {
    const listed: GeneralAssetWithTags[] = []
    const unlisted: GeneralAssetWithTags[] = []

    const pageOwner = RSS3.getPageOwner()
    const apiUser = RSS3.getAPIUser().persona as IRSS3
    const assetInRSS3 = await apiUser.assets.get(pageOwner.address)
    const assetInAssetProfile = await getAssetProfileWaitTillSuccess(pageOwner.address, type)
    const allAssets = await utils.mergeAssetsTags(assetInRSS3, assetInAssetProfile)

    for (const asset of allAssets) {
        if (asset.type.endsWith(type)) {
            if (asset.tags?.includes(`${config.tags.prefix}:${config.tags.hiddenTag}`)) {
                unlisted.push(asset)
            } else {
                listed.push(asset)
            }
        }
    }

    return {
        listed: utils.sortByOrderTag(listed).slice(0, limit),
        unlisted: unlisted.slice(0, limit),
    }
}

async function getAssetProfileWaitTillSuccess(address: string, type: string, delay: number = 500) {
    return new Promise<GeneralAsset[]>(async (resolve, reject) => {
        const tryReq = async () => {
            try {
                const assetProfileRes = await RSS3.getAssetProfile(address, type)
                if (assetProfileRes?.status) {
                    resolve(assetProfileRes?.assets || [])
                }
                return true
            } catch (error) {
                reject(error)
            }
            return false
        }

        if (!(await tryReq())) {
            const iv = setInterval(async () => {
                if (await tryReq()) {
                    clearInterval(iv)
                }
            }, delay)
        }
    })
}

async function initAccounts() {
    const listed: RSS3Account[] = []
    const unlisted: RSS3Account[] = []

    const pageOwner = RSS3.getPageOwner()
    const apiUser = RSS3.getAPIUser().persona as IRSS3
    const allAccounts = await apiUser.accounts.get(pageOwner.address)

    for (const account of allAccounts) {
        if (account.tags?.includes(`${config.tags.prefix}:${config.tags.hiddenTag}`)) {
            unlisted.push(account)
        } else {
            listed.push(account)
        }
    }

    return {
        listed: utils.sortByOrderTag(listed),
        unlisted,
    }
}

function extractEmbedFields(raw: string, fieldsEmbed: string[]) {
    const fieldPattern = /<([a-z]+?)#(.+?)>/gi
    const fields = raw.match(fieldPattern) || []
    const extracted = raw.replace(fieldPattern, '')
    const fieldsMatch: {
        [key: string]: string
    } = {}

    for (const field of fields) {
        const splits = fieldPattern.exec(field) || []
        if (fieldsEmbed.includes(splits[1])) {
            fieldsMatch[splits[1]] = splits[2]
        }
    }

    return {
        extracted,
        fieldsMatch,
    }
}

const utils = {
    sortByOrderTag,
    setOrderTag,
    setHiddenTag,
    mergeAssetsTags,
    initAssets,
    initAccounts,
    extractEmbedFields,
}

export default utils
