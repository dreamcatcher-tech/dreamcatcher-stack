let count = 0
module.exports = (ctx, msg = 'Test Error') => {
  throw new Error(msg + ' ' + count++)
}

module.exports.help = `Throw an error, to test system response`
