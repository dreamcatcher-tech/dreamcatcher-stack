import { covenantIdModel } from '../w015-models'

import collection from './src/collection'
collection.covenantId = covenantIdModel.create('collection')

import datum from './src/datum'

import dpkg from './src/dpkg'
dpkg.covenantId = covenantIdModel.create('dpkg')

import shell from './src/shell'
shell.covenantId = covenantIdModel.create('shell')

import net from '../w020-emulators/src/netFactory'
net.covenantId = covenantIdModel.create('net')

import socket from '../w020-emulators/src/socketFactory'
socket.covenantId = covenantIdModel.create('socket')

import hyper from './src/hyper'
hyper.covenantId = covenantIdModel.create('hyper')

const unity = { reducer: (state = {}) => state }
unity.covenantId = covenantIdModel.create('unity')

import probe from './src/probe'
probe.covenantId = covenantIdModel.create('probe')

Object.values({
  collection,
  datum,
  dpkg,
  hyper,
  net,
  probe,
  shell,
  socket,
  unity,
}).forEach(Object.freeze)

export { collection, datum, dpkg, hyper, net, probe, shell, socket, unity }
