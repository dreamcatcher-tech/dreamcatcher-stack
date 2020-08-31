const path = require('path')
const fs = require('fs')
const child_process = require('child_process')
const spawn = child_process.spawn
const makeTmpDir = require('../../w014-make-tmp-dir')
const crypto = require('../../w012-crypto')

const cache = {}

const pack = async (packagePath, logger = console) => {
  if (cache[packagePath]) {
    return cache[packagePath]
  }
  let sanitizedPath = packagePath
  if (fs.existsSync(packagePath)) {
    sanitizedPath = path.resolve(packagePath)
  }
  const tmpdir = await makeTmpDir('packer', logger)
  const npm = spawn('npm', ['pack', sanitizedPath], {
    detached: true,
    cwd: tmpdir,
  })

  let tarballPath

  const packPromise = new Promise((resolve, reject) => {
    npm.on('error', (err) => {
      let errorMessage = err.message
      npm.unref()
      reject(errorMessage)
    })
    npm.stdout.on('data', (tarball) => {
      const tarballName = tarball.toString().replace(/(\r\n|\n|\r)/gm, '')
      tarballPath = path.join(tmpdir, `${tarballName}`)
    })
    npm.on('close', (code) => {
      if (code == 0) {
        npm.unref()
      }
      try {
        const buffer = fs.readFileSync(tarballPath)
        const hash = crypto.hash(buffer.toJSON())
        logger.info(
          'packed:',
          packagePath,
          '\nhash:',
          hash,
          '\ntarball:',
          tarballPath
        )
        resolve({ hash, buffer })
      } catch (error) {
        reject(error.message)
      }
    })
  })
  cache[packagePath] = packPromise
  return packPromise
}

module.exports = pack
