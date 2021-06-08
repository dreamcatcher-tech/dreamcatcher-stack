const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

module.exports = async (ctx, ...args) => {
  console.log(
    `
`
  )
  require('better-opn')('https://aws.amazon.com/cognito/')
  return timeout(2000)
}

module.exports.help = `
Disconnect from the current remote host, else error and stay as local
`
