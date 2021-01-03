const { covenantIdModel } = require('../w015-models')

const collection = require('./src/collection')
collection.covenantId = covenantIdModel.create('collection')

const datum = require('./src/datum')
datum.covenantId = covenantIdModel.create('datum')

const dpkg = require('./src/dpkg')
dpkg.covenantId = covenantIdModel.create('dpkg')

const shell = require('./src/shell')
shell.covenantId = covenantIdModel.create('shell')

const net = require('../w020-emulators/src/netFactory')
net.covenantId = covenantIdModel.create('net')

const socket = require('../w020-emulators/src/socketFactory')
socket.covenantId = covenantIdModel.create('socket')

const hyper = require('./src/hyper')
hyper.covenantId = covenantIdModel.create('hyper')

const unity = { reducer: (state = {}) => state }
unity.covenantId = covenantIdModel.create('unity')

const probe = require('./src/probe')
probe.covenantId = covenantIdModel.create('probe')

module.exports = {
  collection,
  datum,
  dpkg,
  hyper,
  net,
  probe,
  shell,
  socket,
  unity,
}

Object.values(module.exports).forEach(Object.freeze)
