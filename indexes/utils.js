export function getOrSetDefault (object, key, defaultValue) {
  let existing = object[key]
  if (existing !== undefined) return existing
  object[key] = defaultValue
  return defaultValue
}

// export default { getOrSetDefault }
