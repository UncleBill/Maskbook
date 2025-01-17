import urlcat from 'urlcat'
import { EMPTY_LIST } from '@masknet/shared-base'
import { fetchJSON } from '../helpers/fetchJSON.js'
import type { FireflyBaseAPI } from '../entry-types.js'

const BASE_URL = 'https://api.dimension.im/v1'
const TWITTER_HANDLER_VERIFY_URL = 'https://twitter-handler-proxy.r2d2.to'
export class Firefly {
    static async getLensByTwitterId(twitterHandle?: string, isVerified = true): Promise<FireflyBaseAPI.LensAccount[]> {
        if (!twitterHandle) return EMPTY_LIST
        const result = await fetchJSON<FireflyBaseAPI.LensResult>(
            urlcat(BASE_URL, '/account/lens', {
                twitterHandle,
                isVerified,
            }),
        )
        if (result.code !== 200) return EMPTY_LIST
        return result.data
    }
    static async verifyTwitterHandleByAddress(address: string, handle?: string): Promise<boolean> {
        if (!handle || !address) return false
        const response = await fetchJSON<FireflyBaseAPI.VerifyTwitterResult>(
            urlcat(TWITTER_HANDLER_VERIFY_URL, '/v1/relation/handles', {
                wallet: address.toLowerCase(),
                isVerified: true,
            }),
        )

        if ('error' in response) return false

        return response.data.includes(handle)
    }
}
