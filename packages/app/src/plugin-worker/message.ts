import {
    __workaround__replaceImplementationOfCreatePluginMessage__,
    __workaround__replaceIsBackground__,
    type PluginMessageEmitter,
    type PluginMessageEmitterItem,
} from '@masknet/plugin-infra'
import type { Serialization } from '@dimensiondev/holoflows-kit'
import { addListener, broadcastMessage, type InternalMessage_PluginMessage } from './message-port.js'

// Plugin Message
function createProxy(initValue: (key: string) => any): any {
    function set(key: string) {
        const value = initValue(key)
        Object.defineProperty(container, key, { value, configurable: true })
        return value
    }
    const container = {
        __proto__: new Proxy(
            { __proto__: null },
            {
                get(_, key) {
                    if (typeof key === 'symbol') return undefined
                    return set(key)
                },
            },
        ),
    }
    return new Proxy(container, {
        getPrototypeOf: () => null,
        setPrototypeOf: (_, v) => v === null,
        getOwnPropertyDescriptor: (_, key) => {
            if (typeof key === 'symbol') return undefined
            if (!(key in container)) set(key)
            return Object.getOwnPropertyDescriptor(container, key)
        },
    })
}

const cache = new Map<string, PluginMessageEmitter<unknown>>()
__workaround__replaceIsBackground__(() => true)
__workaround__replaceImplementationOfCreatePluginMessage__(function (
    pluginID: string,
    serializer: Serialization | undefined,
): PluginMessageEmitter<unknown> {
    if (cache.has(pluginID)) return cache.get(pluginID)! as PluginMessageEmitter<unknown>

    const listeners = new Map<string, Set<(data: unknown) => void>>()
    addListener(pluginID, async (message) => {
        const [type, data] = message as InternalMessage_PluginMessage
        dispatchData(type, await de_ser(data))
    })
    function getEventName(name: string) {
        if (!listeners.has(name)) listeners.set(name, new Set())
        return listeners.get(name)!
    }
    function dispatchData(...[type, data]: InternalMessage_PluginMessage) {
        const fns = getEventName(type)
        for (const fn of fns) {
            try {
                fn(data)
            } catch (error) {
                console.error(error)
            }
        }
    }
    function ser(data: unknown) {
        if (serializer) return serializer.serialization(data)
        return data
    }
    function de_ser(data: unknown) {
        if (serializer) return serializer.deserialization(data)
        return data
    }
    const emitter = createProxy((eventName) => {
        const value: PluginMessageEmitterItem<unknown> = {
            on(callback) {
                const events = getEventName(eventName)
                events.add(callback)
                return () => events.delete(callback)
            },
            off(callback) {
                getEventName(eventName).delete(callback)
            },
            async sendByBroadcast(data) {
                broadcastMessage(pluginID, [eventName, await ser(data)] satisfies InternalMessage_PluginMessage)
            },
            async sendToAll(data) {
                broadcastMessage(pluginID, [eventName, await ser(data)] satisfies InternalMessage_PluginMessage)
                dispatchData(eventName, data)
            },
            sendToLocal(data) {
                dispatchData(eventName, data)
            },
            async sendToVisiblePages(data) {
                broadcastMessage(pluginID, [eventName, await ser(data), true] satisfies InternalMessage_PluginMessage)
            },
        }
        return value
    })
    cache.set(pluginID, emitter)
    return emitter
})
