import { memo } from 'react'
import { Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import { PopupRoutes } from '@masknet/shared-base'
import { useWallets } from '@masknet/web3-hooks-base'
import Unlock from '../Unlock/index.js'
import { WalletStartUp } from '../components/StartUp/index.js'
import { WalletSetupHeaderUI } from '../components/WalletHeader/WalletSetupHeaderUI.js'
import { WalletHeader } from '../components/WalletHeader/index.js'
import { useWalletLockStatus } from '../hooks/index.js'
import { useMessageGuard } from './useMessageGuard.js'
import { usePaymentPasswordGuard } from './usePaymentPasswordGuard.js'

export const WalletGuard = memo(function WalletGuard() {
    const wallets = useWallets()
    const outletContext = useOutletContext()
    const location = useLocation()
    const [params] = useSearchParams()
    const { isLocked, isLoading } = useWalletLockStatus()

    const hitPaymentPasswordGuard = usePaymentPasswordGuard()
    const hitMessageGuard = useMessageGuard()

    if (!wallets.length) {
        return (
            <>
                <WalletHeader />
                <WalletStartUp />
            </>
        )
    }
    if (hitPaymentPasswordGuard) {
        params.set('from', location.pathname)
        return <Navigate to={{ pathname: PopupRoutes.SetPaymentPassword, search: params.toString() }} />
    }
    if (isLocked && !isLoading) {
        return (
            <>
                <WalletSetupHeaderUI />
                <Unlock />
            </>
        )
    }
    if (hitMessageGuard) return <Navigate to={PopupRoutes.ContractInteraction} />

    return (
        <>
            <WalletHeader />
            <Outlet context={outletContext} />
        </>
    )
})
