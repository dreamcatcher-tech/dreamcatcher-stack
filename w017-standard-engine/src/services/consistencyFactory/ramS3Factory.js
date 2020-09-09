const debug = require('debug')('interblock:aws:ramS3')
const assert = require('assert')
const _ = require('lodash')

const ramS3Factory = () => {
  const buckets = {
    wbblockbucket: {},
    wbinterbucket: {},
  }

  const putObject = ({ Bucket, Key, Body }) => {
    debug(`putObject %O %O`, Bucket, Key)
    assert(typeof Bucket === 'string')
    assert(typeof Key === 'string')
    assert(typeof Body === 'object')
    return {
      promise: async () => {
        await Promise.resolve()
        assert(buckets[Bucket])
        if (buckets[Bucket][Key]) {
          debug(`item already exists: %O %O`, Bucket, Key)
        }
        buckets[Bucket][Key] = Body
        return true
      },
    }
  }
  const getObject = ({ Bucket, Key }) => {
    debug(`getObject %O %O`, Bucket, Key)
    assert(typeof Bucket === 'string')
    assert(typeof Key === 'string')
    return {
      promise: async () => {
        await Promise.resolve()
        assert(buckets[Bucket])
        if (!buckets[Bucket][Key]) {
          debug(Bucket)
          debug(Key)
        }
        assert(buckets[Bucket][Key])
        const Body = buckets[Bucket][Key]
        return { Body }
      },
    }
  }
  const deleteObject = ({ Bucket, Key }) => {
    debug(`deleteObject %O %O`, Bucket, Key)
    return {
      promise: async () => {
        await Promise.resolve()
        assert(buckets[Bucket])
        assert(buckets[Bucket][Key])
        delete buckets[Bucket][Key]
        return true
      },
    }
  }

  const _getBuckets = () => buckets
  const _isRam = true
  return { putObject, getObject, deleteObject, _getBuckets, _isRam }
}

module.exports = { ramS3Factory }
