// utils.js
export const isObject = (value) => value != null && typeof value === 'object'
export const isArray = Array.isArray
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val, key) => hasOwnProperty.call(val, key)
export const defaultFunction = () => void 0
export const isFunction = (val) => typeof val === 'function'
