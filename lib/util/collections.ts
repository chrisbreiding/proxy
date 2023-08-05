export function clone<T> (obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function compact<T> (array: (T | undefined)[]): T[] {
  return array.reduce((memo: T[], item: T | undefined) => {
    return item ? memo.concat(item) : memo
  }, [] as T[])
}

export function insertAtIndex (array: any[], toInsert: any[], index: number) {
  return [
    ...array.slice(0, index),
    ...toInsert,
    ...array.slice(index),
  ]
}

export async function mapPromisesSerially<T, U> (array: U[], callback: (arg: U) => Promise<T>) {
  const result: T[] = []

  for (const item of array) {
    result.push(await callback(item))
  }

  return result
}

export function times (num: number) {
  return (new Array(num)).fill(undefined)
}
