const os = require('os')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const uuid = require('uuid/v4')
const rimrafAsync = promisify(rimraf)

const makeTmpDir = async (optionalPrefix, logger = console) => {
  const prefix = optionalPrefix ? optionalPrefix + '_' : ''
  const uniqueId = 'interblock_' + prefix + uuid()
  const tmpdir = path.join(os.tmpdir(), uniqueId)
  await rimrafAsync(tmpdir)
  fs.mkdirSync(tmpdir)
  logger.info('created tmpdir: ', tmpdir)
  return tmpdir
}

module.exports = makeTmpDir
