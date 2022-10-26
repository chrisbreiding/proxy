interface Diff {
  lines: any[]
  lineCountDeleted: number
  lineCountInserted: number
  lineCountMoved: number
}

export function patienceDiffPlus(arr1: string[], arr2: string[]): Diff
