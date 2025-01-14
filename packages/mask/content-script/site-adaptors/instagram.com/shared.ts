import type { SiteAdaptor } from '@masknet/types'
import { createSiteAdaptorSpecializedPostContext } from '../../site-adaptor-infra/utils/create-post-context.js'
import { hasPayloadLike } from '../../utils/index.js'
import { instagramBase } from './base.js'

export const instagramShared: SiteAdaptor.Shared & SiteAdaptor.Base = {
    ...instagramBase,
    utils: {
        createPostContext: createSiteAdaptorSpecializedPostContext({
            hasPayloadLike,
        }),
    },
}
