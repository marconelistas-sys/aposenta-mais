// Logical account separation. This is not encryption against access to browser files.
export function createOwnedStorage(resolve) {
  let owner = null
  let generation = 0
  const keyFor = key => owner === null ? key : `aposenta-owner:${owner}:${key}`
  return {
    select(userId) {
      if (userId !== null && (typeof userId !== 'string' || !/^[\w-]{1,80}$/.test(userId))) throw new Error('Identidade inválida.')
      owner = userId
      generation++
    },
    get owner() { return owner },
    get generation() { return generation },
    getItem: key => resolve().getItem(keyFor(key)),
    setItem: (key, value) => resolve().setItem(keyFor(key), value),
    removeItem: key => resolve().removeItem(keyFor(key))
  }
}
export const ownedStorage = createOwnedStorage(() => {
  if (!globalThis.localStorage) throw new Error('Armazenamento indisponível.')
  return globalThis.localStorage
})
