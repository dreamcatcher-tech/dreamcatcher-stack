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
