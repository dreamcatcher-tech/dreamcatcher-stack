const { covenantIdModel } = require('../w015-models')
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

module.exports = { shell, net, socket, unity, hyper, probe }

Object.values(module.exports).forEach(Object.freeze)
