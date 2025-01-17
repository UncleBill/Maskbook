import { type BackupSummary, generateBackupRAW, getBackupSummary } from '@masknet/backup-format'
import { createNewBackup } from './internal_create.js'
import { env } from '@masknet/flags'

const maskVersion = env.VERSION
export async function generateBackupPreviewInfo(): Promise<BackupSummary> {
    // can we avoid create a full backup?
    const backup = await createNewBackup({ allProfile: true, maskVersion })
    return getBackupSummary(backup)
}

export interface BackupOptions {
    excludeWallet?: boolean
    /** Includes persona, relations, posts and profiles. */
    excludeBase?: boolean
}
export async function createBackupFile(options: BackupOptions): Promise<{
    file: unknown
    personaNickNames: string[]
}> {
    const { excludeBase, excludeWallet } = options
    const backup = await createNewBackup({
        noPersonas: excludeBase,
        noPosts: excludeBase,
        noProfiles: excludeBase,
        noWallets: excludeWallet,
        maskVersion,
    })
    const file = generateBackupRAW(backup)
    const personaNickNames = [...backup.personas.values()].map((p) => p.nickname.unwrapOr('')).filter(Boolean)
    return { file, personaNickNames }
}
