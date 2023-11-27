export function chunk<T = any> (array: T[], size: number) {
  if (!array.length) return []

  let index = 0
  const result = []

  while (index < array.length) {
    result.push(array.slice(index, index + size))

    index += size
  }

  return result
}

export function clone<T> (obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function compact<T> (array: (T | undefined)[]): T[] {
  return array.reduce((memo, item) => {
    return item ? memo.concat(item) : memo
  }, [] as T[])
}

export async function mapPromisesSerially<T, U> (array: U[], callback: (arg: U) => Promise<T>) {
  const result: T[] = []

  for (const item of array) {
    result.push(await callback(item))
  }

  return result
}

export function times (num: number, filler?: any) {
  return (new Array(num)).fill(filler)
}
