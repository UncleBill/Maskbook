import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { type Subscription } from 'use-subscription'

/**
 * In favor of react-query's persist cache and cache management
 */
export function usePersistSubscription<T>(
    persistKey: `@@${string}`,
    subscription: Subscription<T>,
    predicate?: (data: T) => boolean,
): T {
    const [initialValue] = useState(() => subscription.getCurrentValue())
    const { data = initialValue, refetch } = useQuery({
        queryKey: [persistKey],
        networkMode: 'always',
        queryFn: () => {
            const value = subscription.getCurrentValue()
            if (predicate && !predicate(value)) return undefined
            return value
        },
    })
    useEffect(() => {
        refetch() // Actively fetch, make persist data act as placeholder data
        return subscription.subscribe(refetch)
    }, [subscription, refetch])

    return data
}
