// test4.js
function fn() {
  return this.a
}

const obj1 = {
  a: 'hello',
}

const obj2 = {
  a: 'world',
}

obj1.fn = fn
const a1 = obj1.fn()
console.log(a1, 'obj1')

obj2.fn = obj1.fn
const a2 = obj2.fn()
console.log(a2, 'obj2')

console.log(fn === obj1.fn, fn === obj2.fn)
// hello obj1
// world obj2
// true true
