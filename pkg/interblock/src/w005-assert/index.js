/**
 * Replacement assert module
 */

const assert = (booleanish, message) => {
  if (!booleanish) {
    throw new Error(message)
  }
}

assert.strictEqual = (a, b, message) => {
  if (a !== b) {
    throw new Error(message)
  }
}

export default assert
