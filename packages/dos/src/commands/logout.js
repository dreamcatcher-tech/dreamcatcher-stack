const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

export const logout = async (ctx, ...args) => {
  console.log(
    `
`
  )
  return timeout(2000)
}

export const help = `
Disconnect from the current remote host, else error and stay as local
`
