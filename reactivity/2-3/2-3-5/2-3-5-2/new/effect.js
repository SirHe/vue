// effect.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { ITERATE_KEY } from './baseHandlers.js'

let activeEffect = null
const effectStack = []
const targetMap = new WeakMap()

const triggerTypeMap = {
  [TriggerOpTypes.ADD]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.DELETE]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.SET]: [TrackOpTypes.GET],
}

// 依赖收集
export const track = (target, type, key) => {
  // obj -> prop -> type -> fn
  let propsMap = targetMap.get(target)
  if (!propsMap) {
    propsMap = new Map()
    targetMap.set(target, propsMap)
  }
  let typeMap = propsMap.get(key)
  if (!typeMap) {
    typeMap = new Map()
    propsMap.set(key, typeMap)
  }
  let fnSet = typeMap.get(type)
  if (!fnSet) {
    fnSet = new Set()
    typeMap.set(type, fnSet)
  }
  fnSet.add(activeEffect)
  if (!activeEffect.deps) {
    activeEffect.deps = []
  }
  activeEffect.deps.push(fnSet)
}

// 派发更新
export const trigger = (target, type, key) => {
  const propsMap = targetMap.get(target)
  if (!propsMap) {
    return
  }
  const keys = [key]
  if (type === TriggerOpTypes.ADD || type === TriggerOpTypes.DELETE) {
    keys.push(ITERATE_KEY)
  }
  let fnSet = []
  for (let key of keys) {
    const typeMap = propsMap.get(key)
    if (!typeMap) {
      continue
    }
    const triggerTypes = triggerTypeMap[type]
    fnSet = triggerTypes.reduce((arr, type) => {
      arr.push(...(typeMap.get(type) || []))
      return arr
    }, [])
  }
  fnSet = new Set(fnSet)
  ;[...fnSet].forEach((fn) => {
    activeEffect = fn
    cleanupEffect(fn)
    effectStack.push(fn)
    fn()
    effectStack.pop()
    activeEffect = effectStack.at(-1)
  })
}

// 代理依赖函数
export const effect = (fn) => {
  activeEffect = fn
  effectStack.push(fn)
  fn()
  effectStack.pop()
  activeEffect = effectStack.at(-1)
}

function cleanupEffect(effect) {
  const { deps } = effect
  if (!deps?.length) {
    return
  }
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
  deps.length = 0
}
