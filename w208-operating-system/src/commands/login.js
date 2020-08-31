const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

module.exports = async (ctx, ...args) => {
  console.log(
    `
`
  )
  require('open')('https://aws.amazon.com/cognito/')
  return timeout(2000)
}

module.exports.help = `Loop the user through a signon process that links
The current machine pubkey to their interblock user chain.
When this occurs, the guest chain will transition to the
user chain, and the prompt will change from "guest" to "user"`
