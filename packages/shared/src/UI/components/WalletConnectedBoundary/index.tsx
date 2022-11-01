import { makeStyles, useStylesExtends, ActionButton, ActionButtonProps } from '@masknet/theme'
import classNames from 'classnames'
import { useRemoteControlledDialog } from '@masknet/shared-base-ui'
import { WalletMessages } from '@masknet/plugin-wallet'
import { useSharedI18N } from '../../../locales/index.js'
import { isZero } from '@masknet/web3-shared-base'
import {
    useChainContext,
    useNetworkContext,
    useNativeTokenBalance,
    useRiskWarningApproved,
} from '@masknet/web3-hooks-base'

const useStyles = makeStyles()((theme) => ({
    button: {
        margin: 0,
    },
}))

export interface WalletConnectedBoundaryProps
    extends withClasses<'connectWallet' | 'unlockMetaMask' | 'gasFeeButton' | 'invalidButton' | 'button'> {
    offChain?: boolean
    children?: React.ReactNode
    hideRiskWarningConfirmed?: boolean
    ActionButtonProps?: ActionButtonProps
    startIcon?: React.ReactNode
}

export function WalletConnectedBoundary(props: WalletConnectedBoundaryProps) {
    const { children = null, offChain = false, hideRiskWarningConfirmed = false } = props

    const t = useSharedI18N()
    const classes = useStylesExtends(useStyles(), props)

    const { pluginID } = useNetworkContext()
    const { account, chainId: chainIdValid } = useChainContext()
    const nativeTokenBalance = useNativeTokenBalance()
    const approved = useRiskWarningApproved()

    const { setDialog: setRiskWarningDialog } = useRemoteControlledDialog(
        WalletMessages.events.walletRiskWarningDialogUpdated,
    )
    const { openDialog: openSelectProviderDialog } = useRemoteControlledDialog(
        WalletMessages.events.selectProviderDialogUpdated,
    )

    const buttonClass = classNames(classNames(classes.button, classes.connectWallet))

    if (!account)
        return (
            <ActionButton
                startIcon={props.startIcon}
                className={buttonClass}
                fullWidth
                onClick={openSelectProviderDialog}
                {...props.ActionButtonProps}>
                {t.plugin_wallet_connect_a_wallet()}
            </ActionButton>
        )

    if (!approved && !hideRiskWarningConfirmed)
        return (
            <ActionButton
                className={buttonClass}
                fullWidth
                variant="contained"
                onClick={() => {
                    setRiskWarningDialog({
                        open: true,
                        account,
                        pluginID,
                    })
                }}
                {...props.ActionButtonProps}>
                {t.plugin_wallet_confirm_risk_warning()}
            </ActionButton>
        )

    if (isZero(nativeTokenBalance.value ?? '0') && !offChain)
        return (
            <ActionButton
                className={buttonClass}
                disabled={!nativeTokenBalance.error}
                fullWidth
                variant="contained"
                onClick={nativeTokenBalance.retry}
                {...props.ActionButtonProps}>
                {nativeTokenBalance.loading ? t.plugin_wallet_update_gas_fee() : t.plugin_wallet_no_gas_fee()}
            </ActionButton>
        )

    if (!chainIdValid && !offChain)
        return (
            <ActionButton className={buttonClass} disabled fullWidth variant="contained" {...props.ActionButtonProps}>
                {t.plugin_wallet_invalid_network()}
            </ActionButton>
        )

    return <>{children}</>
}