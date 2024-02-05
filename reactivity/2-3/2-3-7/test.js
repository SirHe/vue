// test.js
const obj = { a: 1 }

const proxyObj = new Proxy(obj, {
    set(obj, prop, value) {
        console.log('set')
        obj[prop] = value
    }
})

Object.defineProperty(proxyObj, 'a', { value: 2 })
console.log(proxyObj.a)