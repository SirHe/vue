// reactive.js
import {
    mutableHandlers,
    readonlyHandlers,
    shallowReactiveHandlers,
    shallowReadonlyHandlers,
} from './baseHandlers.js'
import {
    mutableCollectionHandlers,
    readonlyCollectionHandlers,
    shallowCollectionHandlers,
    shallowReadonlyCollectionHandlers,
} from './collectionHandlers.js'
import { ReactiveFlags } from './constants.js'
import { isObject, toRawType } from './utils.js'

export const reactiveMap = new WeakMap()
export const shallowReactiveMap = new WeakMap()
export const readonlyMap = new WeakMap()
export const shallowReadonlyMap = new WeakMap()

const TargetType = {
    INVALID: 0,
    COMMON: 1,
    COLLECTION: 2,
}

function targetTypeMap(rawType) {
    switch (rawType) {
        case 'Object':
        case 'Array':
            return TargetType.COMMON
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return TargetType.COLLECTION
        default:
            return TargetType.INVALID
    }
}

function getTargetType(value) {
    return targetTypeMap(toRawType(value))
}

export const reactive = (target) => {
    // 只能对对象类型的数据进行代理
    if (!isObject(target)) {
        return target
    }

    if (isReadonly(target)) {
        return target
    }
    return createReactiveObject(
        target,
        false,
        mutableHandlers,
        mutableCollectionHandlers,
        reactiveMap
    )
}

export function shallowReactive(target) {
    return createReactiveObject(
        target,
        false,
        shallowReactiveHandlers,
        shallowCollectionHandlers,
        shallowReactiveMap
    )
}

export function readonly(target) {
    return createReactiveObject(
        target,
        true,
        readonlyHandlers,
        readonlyCollectionHandlers,
        readonlyMap
    )
}

export function shallowReadonly(target) {
    return createReactiveObject(
        target,
        true,
        shallowReadonlyHandlers,
        shallowReadonlyCollectionHandlers,
        shallowReadonlyMap
    )
}

function createReactiveObject(
    target,
    isReadonly,
    baseHandlers,
    collectionHandlers,
    proxyMap
) {
    if (!isObject(target)) {
        return target
    }
    // target is already a Proxy, return it.
    if (
        target[ReactiveFlags.RAW] &&
        !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
    ) {
        return target
    }
    // target already has corresponding Proxy
    const existingProxy = proxyMap.get(target)
    if (existingProxy) {
        return existingProxy
    }
    // only specific value types can be observed.
    const targetType = getTargetType(target)
    if (targetType === TargetType.INVALID) {
        return target
    }
    const proxy = new Proxy(
        target,
        targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
    )
    proxyMap.set(target, proxy)
    return proxy
}

export function isReadonly(value) {
    return !!(value && value[ReactiveFlags.IS_READONLY])
}

export const RAW = Symbol('raw')

export const toRaw = (observed) => {
    const raw = observed?.[RAW]
    return raw ? toRaw(raw) : observed
}

export const toReadonly = (value) =>
    isObject(value) ? readonly(value) : value


export const toReactive = (value) =>
    isObject(value) ? reactive(value) : value