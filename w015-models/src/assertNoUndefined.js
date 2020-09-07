const assert = require('assert')
const traverse = require('traverse')

const assertNoUndefined = (obj) => {
  traverse(obj).forEach(function (val) {
    if (typeof val === 'undefined') {
      throw new Error(`Values cannot be undefined: ${this.path}`)
    }
  })
}

module.exports = { assertNoUndefined }
