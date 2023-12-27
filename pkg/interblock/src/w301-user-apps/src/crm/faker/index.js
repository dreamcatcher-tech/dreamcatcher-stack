export * as routing from './routing'

export * as customers from './customers'

export const stripFaker = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(stripFaker)
  }
  const result = {}
  for (const key of Object.keys(obj)) {
    if (key === 'faker') {
      continue
    }
    result[key] = stripFaker(obj[key])
  }
  return result
}
