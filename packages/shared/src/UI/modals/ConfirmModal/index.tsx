import { forwardRef, useState } from 'react'
import type { SingletonModalRefCreator } from '@masknet/shared-base'
import { Confirm } from './Dialog.js'
import type { InjectedDialogProps } from '../../contexts/index.js'
import { useSingletonModal } from '../../../hooks/useSingletonModal.js'

export interface ConfirmModalOpenProps extends Omit<InjectedDialogProps, 'title' | 'onSubmit' | 'content' | 'open'> {
    title?: string
    confirmLabel?: React.ReactNode | string
    content: React.ReactNode | string
    onSubmit?(result: boolean | null): void
    maxWidthOfContent?: number
}

export interface ConfirmModalProps {}

export const ConfirmModal = forwardRef<SingletonModalRefCreator<ConfirmModalOpenProps>, ConfirmModalProps>(
    (props, ref) => {
        const [props_, setProps_] = useState<ConfirmModalOpenProps>()
        const [open, dispatch] = useSingletonModal(ref, {
            onOpen(props) {
                setProps_(props)
            },
        })

        if (!open) return null
        return <Confirm open onClose={() => dispatch?.close()} {...props_} content={props_?.content} />
    },
)