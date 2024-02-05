// test3.js
const obj = {}
Object.defineProperty(obj, 'a', {
  get() {
    return this.abc
  },
})
const a = Reflect.get(obj, 'a', { abc: 'hello' })
console.log(a)
// hello
