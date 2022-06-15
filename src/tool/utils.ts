// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function sizeOf(value: any): number {
  if (value === null) {
    return 0
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((total, [k, v]) => total + sizeOf(k) + sizeOf(v), 0)
  }

  if (Array.isArray(value)) {
    return Object.entries(value).reduce((total, v) => total + sizeOf(v), 0)
  }

  if (typeof value === 'string') {
    return value.length
  }

  return 1
}

export function loadImage(url: string, w: number, h: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image(w, h)
    img.onload = () => {
      resolve(img)
    }
    img.onerror = (event) => {
      // eslint-disable-next-line no-console
      console.log('Image error', event)
      resolve(null)
    }
    img.src = url
  })
}

export function sortBy<T>(array: T[], f: (t: T) => number): T[] {
  return array.sort((a, b) => {
    const va = f(a)
    const vb = f(b)
    // eslint-disable-next-line no-nested-ternary
    return va < vb ? -1 : va > vb ? 1 : 0
  })
}

export function truncate(s: string, limit: number): string {
  if (s.length > limit) {
    return `${s.substring(0, limit)}…`
  }
  return s
}
