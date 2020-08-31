const assert = require('assert')
const path = require('path')
const fs = require('fs')
const tar = require('tar')
const { promisify } = require('util')
const rimraf = require('rimraf')
const rimrafAsync = promisify(rimraf)
const promiseWrite = promisify(fs.writeFile)
const pack = require('../../w007-packer')
const makeTmpDir = require('../../w014-make-tmp-dir')

const pathToCovenant = path.join(__dirname, 'testReducers', 'app')
describe.skip('covenant installer', () => {
  jest.setTimeout(20000)
  let persistence, installer

  beforeEach(() => {
    jest.resetModules()
    installer = require('../src/index')
  })
  test('halts if covenant does not exist in storage', async () => {
    assert.rejects(
      () => installer('someArbitraryCovenantHash', console, persistence),
      { message: 'covenant not found' }
    )
  })
  test('stores the covenant binary in the storage', async () => {
    await rimrafAsync(path.join(pathToCovenant, 'node_modules'))
    const { hash, buffer } = await pack(pathToCovenant)
    await persistence.storeCovenant(hash, buffer)
    assert(hash)

    await installer(hash, console, persistence)

    const tarBinary = await persistence.fetch(`image_${hash}`)
    assert(tarBinary)

    const tmpdir = await makeTmpDir('covenant-installer-test')
    const filePath = path.join(tmpdir, 'installation.tgz')
    const pathToIndex = path.join(tmpdir, 'package')

    await promiseWrite(filePath, tarBinary)
    await tar.x({ cwd: tmpdir, file: filePath })
    const { reducer } = require(pathToIndex)
    assert.deepStrictEqual(reducer([1, 2, 1, 1]), [1, 2])
    await rimrafAsync(tmpdir)
  })
})
