const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const tar = require('tar')
const rimraf = require('rimraf')
const promiseWrite = promisify(fs.writeFile)
const rimrafAsync = promisify(rimraf)
const makeTmpDir = require('../../w014-make-tmp-dir')

/**
 * installCovenant( covenantHash ) -> image_covenantHash.
 * 1. get covenant from S3 by hash
 * 2. run npm install
 * 3. zip all files
 * 4. store in S3 by image_covenantHash
 * 5. return hash to calling function
 */

const installCovenant = async (covenantHash, logger, persistence) => {
  const buffer = await persistence.fetch(covenantHash)
  if (!buffer) {
    throw new Error('covenant not found')
  }

  const tmpdir = await makeTmpDir('installCovenant', logger)
  const fileName = 'covenant.tgz'
  const filePath = path.join(tmpdir, fileName)
  const packagePath = path.join(tmpdir, 'package')

  await promiseWrite(filePath, buffer)
  await tar.x({ cwd: tmpdir, file: filePath })

  await rimrafAsync(path.join(tmpdir, fileName))

  const npm = spawn('npm', ['install', '--quiet'], {
    stdio: 'inherit',
    detached: true,
    cwd: packagePath,
  })

  return new Promise((resolve, reject) => {
    npm.on('error', (err) => {
      let errorMessage = err.message
      if (err.message === 'spawn npm ENOENT') {
        errorMessage = `Trying to install packages into wrong directory ${tmpdir}`
      }
      npm.unref()
      reject(errorMessage)
    })
    npm.on('close', async (code) => {
      if (code === 0) {
        npm.unref()
      }
      //This is saving a stream to cas:
      const contentReadable = tar.c({ cwd: tmpdir }, ['package'])
      const imageHash = `image_${covenantHash}`
      await persistence.putStream(imageHash, contentReadable)
      await rimrafAsync(tmpdir)
      resolve(imageHash)
    })
  })
}

module.exports = installCovenant
