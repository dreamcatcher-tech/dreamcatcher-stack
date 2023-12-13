/**
 * This is the thread management system for the AI.
 */
import Debug from 'debug'
import { interchain, useState } from '../../w002-api'
import merge from 'lodash.merge'
import * as threads from './threads'
import assert from 'assert-fast'

const debug = Debug('interblock:apps:ai')

const name = 'hal'
let { api, reducer, installer } = threads
installer = merge({}, installer, { state: { path: '/' } })
export { name, api, reducer, installer }
