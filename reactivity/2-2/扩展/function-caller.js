// function-caller.js
function a() {
  console.log(arguments.callee.name)
  console.log(arguments.callee.caller.caller.name)
}

function b() {
  a()
}

function c() {
  b()
}

c()
// a
// c
