import { PersistentStorages, type BackupConfig } from '@masknet/shared-base'
import { useCallback, useMemo } from 'react'
import { createContainer } from 'unstated-next'
import { useSubscription } from 'use-subscription'

function useUserContext() {
    const user = useSubscription(PersistentStorages.Settings.storage.backupConfig.subscription)

    const updateUser = useCallback(
        async (obj: Partial<BackupConfig>) => {
            await PersistentStorages.Settings.storage.backupConfig.setValue({
                ...user,
                ...obj,
                backupPassword: obj.backupPassword ? btoa(obj.backupPassword) : user.backupPassword,
            })
        },
        [user],
    )

    const result = useMemo(() => {
        try {
            const backupPassword = user.backupPassword && atob(user.backupPassword)
            return {
                ...user,
                backupPassword,
            }
        } catch {
            // Maybe `backupPassword` is not base64-encoded.
            return user
        }
    }, [user, updateUser])

    return {
        user: result,
        updateUser,
    }
}

export const UserContext = createContainer(useUserContext)
