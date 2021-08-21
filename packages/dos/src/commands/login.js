import Debug from 'debug'
const debug = Debug('dos:commands:login')
const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

export const login = async ({ spinner, blockchain }, ...args) => {
  // see if we have a url for this particular chain address
  const url = 'TODO'

  // choose the default to connect to
  const chainId =
    '34e3c74c43c0e9b2f3f2ef9f93a0f427ededf5878891b23d792d8f7c1a174b94'
  spinner.info(`logging in to ${chainId}`).start()
  spinner.text = `connecting to: ${url}`
  const latency = await blockchain.addTransport(chainId, { url })
  spinner.succeed(`latency of ${latency} ms ${url}`).start()
  spinner.text = `logging in to chain`
  await blockchain.login({ chainId })
  spinner.succeed(`login successful`)
  return { out: url }
}

const help = `Loop the user through a signon process that links
The current machine pubkey to their interblock user chain.
When this occurs, the guest chain will transition to the
user chain, and the prompt will change from "guest" to "user"`
