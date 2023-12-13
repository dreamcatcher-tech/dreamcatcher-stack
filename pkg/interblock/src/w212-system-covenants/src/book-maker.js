/**
 * Makes a book out of the installers on the disk
 */

import { useSchema, useApi, useState, interchain } from '../../w002-api'
import assert from 'assert-fast'
import { Network, Pulse } from '../../w008-ipld/index.mjs'
import Debug from 'debug'
const debug = Debug('interblock:apps:book-maker')

export const makeBook = async (path) => {
  // TODO use the installer so we don't drag up all the colleciton children
  assert(typeof path === 'string')
  const [state] = await useState(path)

  const children = {}
  if (state.type !== 'COLLECTION') {
    // TODO use schema to detect collection
    const { children: childPaths } = await interchain('@@LS', { path })
    for (const childPath of childPaths) {
      const prefix = path === '/' ? '' : path

      children[childPath] = await makeBook(prefix + '/' + childPath)
    }
  }
  const { api } = await useApi(path)
  const [schema] = await useSchema(path)
  return { schema, state, api, children }
}
