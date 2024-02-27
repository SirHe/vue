// utils.js
export const isObject = (value) => value != null && typeof value === 'object'
export const isArray = Array.isArray
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val, key) => hasOwnProperty.call(val, key)
export const objectToString = Object.prototype.toString
export const toTypeString = (value) => objectToString.call(value)
export const toRawType = (value) => {
    // extract "RawType" from strings like "[object RawType]"
    return toTypeString(value).slice(8, -1)
}
export const getProto = (v) =>
    Reflect.getPrototypeOf(v)
