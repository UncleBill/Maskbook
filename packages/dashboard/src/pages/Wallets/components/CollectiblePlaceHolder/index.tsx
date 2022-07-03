import { memo } from 'react'
import { Icon } from '@masknet/icons'
import { makeStyles, MaskColorVar } from '@masknet/theme'
import { WalletIcon } from '@masknet/shared'
import { Box } from '@mui/material'
import { useNetworkDescriptor } from '@masknet/plugin-infra/web3'
import { NetworkPluginID } from '@masknet/web3-shared-base'

const useStyles = makeStyles()((theme) => ({
    container: {
        position: 'relative',
        borderRadius: 8,
        width: 140,
        height: 186,
        backgroundColor: MaskColorVar.lineLight,
        display: 'flex',
        flexDirection: 'column',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    description: {
        flex: 1,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    chainIcon: {
        position: 'absolute',
        right: 8,
        top: 8,
        height: 20,
        width: 20,
    },
    miniMask: {
        opacity: 0.5,
    },
}))

export interface CollectiblePlaceHolderProps {
    chainId?: number
}

export const CollectiblePlaceholder = memo<CollectiblePlaceHolderProps>(({ chainId }) => {
    const { classes } = useStyles()
    const networkDescriptor = useNetworkDescriptor(NetworkPluginID.PLUGIN_EVM, chainId)

    return (
        <div className={classes.container}>
            <Box className={classes.chainIcon}>
                <WalletIcon mainIcon={networkDescriptor?.icon} size={20} />
            </Box>
            <div className={classes.placeholder}>
                <Icon type="miniMask" size={48} className={classes.miniMask} />
            </div>
        </div>
    )
})
