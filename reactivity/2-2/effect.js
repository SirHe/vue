// effect.js
let activeEffect = null
const targetMap = new WeakMap() // 存放数据与依赖函数（数据使用者）的关联关系

// 依赖收集
export const track = (target, key) => {
  let propsMap = targetMap.get(target)
  if (!propsMap) {
    propsMap = new Map()
    targetMap.set(target, propsMap)
  }
  let fnSet = propsMap.get(key)
  if (!fnSet) {
    fnSet = new Set()
    propsMap.set(key, fnSet)
  }
  fnSet.add(activeEffect)
}

// 派发更新
export const trigger = (target, key) => {
  const propsMap = targetMap.get(target)
  const fnSet = propsMap?.get(key) || []
  ;[...fnSet].forEach((fn) => fn())
}

// 代理依赖函数
export const effect = (fn) => {
  activeEffect = fn
  fn()
}
