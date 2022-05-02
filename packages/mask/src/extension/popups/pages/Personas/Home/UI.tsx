// ! This file is used during SSR. DO NOT import new files that does not work in SSR

import { memo } from 'react'
import { makeStyles } from '@masknet/theme'
import { Navigator } from '../../../components/Navigator'
import { Avatar, Button, Typography } from '@mui/material'
import { Icon } from '@masknet/icons'
import { formatPersonaFingerprint, PopupRoutes, formatPersonaName } from '@masknet/shared-base'
import { CopyIconButton } from '../../../components/CopyIconButton'
import { useI18N } from '../../../../../utils/i18n-next-ui'
import { Link } from 'react-router-dom'

const useStyles = makeStyles()({
    container: {
        flex: 1,
        backgroundColor: '#F7F9FA',
        display: 'flex',
        flexDirection: 'column',
    },
    item: {
        padding: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        marginBottom: 1,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: '18px',
        color: '#15181B',
        textDecoration: 'unset',
        cursor: 'pointer',
    },
    content: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flex: 1,
    },
    copy: {
        fontSize: 16,
        fill: '#767F8D',
        cursor: 'pointer',
        marginLeft: 4,
    },
    avatar: {
        marginRight: 4,
        width: 48,
        height: 48,
    },
    arrow: {
        color: '#7B8192',
        fontSize: 24,
    },
    placeholder: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: 318,
    },
    controller: {
        display: 'flex',
        flexDirection: 'column',
        rowGap: 12,
        padding: '0 16px 16px 16px',
    },
    button: {
        padding: '11px 0',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 14,
        width: '100%',
        '& > svg': {
            marginLeft: 4,
            fontSize: 18,
        },
    },
})

export interface PersonaHomeUIProps {
    avatar?: string | null
    fingerprint?: string
    nickname?: string
    accountsCount: number
    walletsCount: number
    onEdit: () => void
    onCreatePersona: () => void
    onRestore: () => void
    fetchProofsLoading: boolean
    isEmpty?: boolean
}

export const PersonaHomeUI = memo<PersonaHomeUIProps>(
    ({
        avatar,
        fingerprint,
        nickname,
        accountsCount,
        walletsCount,
        onEdit,
        fetchProofsLoading,
        isEmpty,
        onCreatePersona,
        onRestore,
    }) => {
        const { t } = useI18N()
        const { classes } = useStyles()

        return (
            <>
                <div className={classes.container}>
                    {!isEmpty ? (
                        <>
                            <div className={classes.item}>
                                <Typography>{t('popups_profile_photo')}</Typography>
                                {avatar ? (
                                    <Avatar src={avatar} className={classes.avatar} />
                                ) : (
                                    <Icon
                                        type="menuPersonasActive"
                                        color="#f9fafa"
                                        className={classes.avatar}
                                        style={{ borderRadius: 99 }}
                                    />
                                )}
                            </div>
                            <div className={classes.item}>
                                <Typography>{t('popups_public_key')}</Typography>
                                {fingerprint ? (
                                    <Typography className={classes.content}>
                                        {formatPersonaFingerprint(fingerprint, 4)}
                                        <CopyIconButton text={fingerprint} className={classes.copy} />
                                    </Typography>
                                ) : null}
                            </div>
                            <Link className={classes.item} to={PopupRoutes.PersonaRename} onClick={onEdit}>
                                <Typography>{t('popups_name')}</Typography>
                                <Typography className={classes.content} onClick={onEdit}>
                                    {formatPersonaName(nickname)}
                                    <Icon type="arrowRightIos" className={classes.arrow} />
                                </Typography>
                            </Link>
                            <Link className={classes.item} to={PopupRoutes.SocialAccounts}>
                                <Typography>{t('popups_social_account')}</Typography>
                                <Typography className={classes.content}>
                                    {!fetchProofsLoading ? accountsCount : '...'}
                                    <Icon type="arrowRightIos" className={classes.arrow} />
                                </Typography>
                            </Link>
                            <Link className={classes.item} to={PopupRoutes.ConnectedWallets}>
                                <Typography>{t('popups_connected_wallets')}</Typography>
                                <Typography className={classes.content}>
                                    {!fetchProofsLoading ? walletsCount : '...'}
                                    <Icon type="arrowRightIos" className={classes.arrow} />
                                </Typography>
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className={classes.placeholder}>
                                <Icon type="empty" size={60} />
                            </div>
                            <div className={classes.controller}>
                                <Button
                                    className={classes.button}
                                    style={{ backgroundColor: '#07101B', color: '#F2F5F6' }}
                                    onClick={onCreatePersona}>
                                    {t('popups_create_persona')}
                                    <Icon type="addUser" color="#F2F5F6" />
                                </Button>
                                <Button
                                    className={classes.button}
                                    style={{ backgroundColor: '#FFFFFF', color: '#07101B' }}
                                    onClick={onRestore}>
                                    {t('popups_restore_and_login')}
                                    <Icon type="popupRestore" color="#07101B" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
                <Navigator />
            </>
        )
    },
)
