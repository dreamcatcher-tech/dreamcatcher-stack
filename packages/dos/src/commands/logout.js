const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

module.exports = async (ctx, ...args) => {
  console.log(
    `
`
  )
  return timeout(2000)
}

module.exports.help = `
Disconnect from the current remote host, else error and stay as local
`
