const path = require('path')
const systemCovenants = require('../../../w212-system-covenants')
/**
 * Runs only in an isolated environment.
 * First time we touch dirty code.
 * Calling require will cause user code to run.
 * System covenants do not need this isolation level.
 *
 * @param {*} covenantReference
 */
const reifyCovenant = (covenantReference) => {
  if (!covenantReference || typeof covenantReference !== 'string') {
    throw new Error(`cannot reify an empty reference: ${covenantReference}`)
  }
  let covenant
  if (covenantReference.startsWith('system/')) {
    const name = covenantReference.substring('system/'.length)
    covenant = systemCovenants[name]
  } else {
    try {
      covenant = require(covenantReference)
    } catch (e) {}
  }
  if (!covenant) {
    throw new Error(
      `no covenant found at reference: ${covenantReference} cwd: ${path.resolve(
        process.cwd()
      )} __dirname: ${__dirname}`
    )
  }
  if (!checkCovenant(covenant)) {
    throw new Error(`invalid object loaded at reference: ${covenantReference}`)
  }
  return covenant
}

const checkCovenant = (covenant) => {
  const ok =
    covenant &&
    covenant.reducer &&
    typeof covenant.reducer === 'function' &&
    covenant.reducer(undefined, { type: '@@INIT' })
  return ok
}

module.exports = { reifyCovenant }
