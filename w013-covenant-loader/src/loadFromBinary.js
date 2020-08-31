const installCovenant = require('../../w011-covenant-installer')
const path = require('path')
const fs = require('fs')
const tar = require('tar')
const { promisify } = require('util')
const promiseWrite = promisify(fs.writeFile)
const makeTmpDir = require('../../w014-make-tmp-dir')

/**
 * (image_covenantHash) ->  reducer
 */
const loadFromTar = async (binStream, logger) => {
  const tmpdir = await makeTmpDir('covenant-loader', logger)
  const filePath = path.join(tmpdir, 'covenant.tgz')
  const pathToIndex = path.join(tmpdir, 'package')

  await promiseWrite(filePath, binStream)
  await tar.x({ cwd: tmpdir, file: filePath })
  return require(pathToIndex) // TODO use memfs ??
}

const loadedCovenants = {}
const loadCovenant = (persistence, logger) => async (covenantHash) => {
  if (loadedCovenants[covenantHash]) {
    return loadedCovenants[covenantHash]
  }
  let tarBinary = await persistence.fetch(`image_${covenantHash}`)
  if (!tarBinary) {
    await installCovenant(covenantHash, logger, persistence)
    tarBinary = await persistence.fetch(`image_${covenantHash}`)
  }

  const { reducer } = await loadFromTar(tarBinary, logger)
  loadedCovenants[covenantHash] = reducer
  return reducer
}

module.exports = loadCovenant
