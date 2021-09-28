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
// TODO add fast-deep-equal as a function
export default assert
