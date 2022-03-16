export const assertNoUndefined = (obj, path = '/') => {
  if (obj === undefined) {
    throw new Error(`undefined value at ${path}`)
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      assertNoUndefined(obj[key], `${path}/${key}`)
    }
  }
}

export const deepFreeze = (obj) => {
  if (Object.isFrozen(obj)) {
    return
  }
  Object.freeze(obj)

  for (const key in obj) {
    if (obj[key] instanceof Uint8Array) {
      continue
    }
    if (typeof obj[key] === 'object') {
      deepFreeze(obj[key])
    }
  }
}
