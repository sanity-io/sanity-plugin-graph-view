export function sizeOf(value) {
  if (value == null) {
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

export function loadImage(url, w, h) {
  return new Promise((resolve) => {
    let img = new Image(w, h)
    img.onload = () => {
      resolve(img)
    }
    img.onerror = (event) => {
      console.log('Image error', event)
      resolve(null)
    }
    img.src = url
  })
}

export function sortBy(array, f) {
  return array.sort((a, b) => {
    const va = f(a)
    const vb = f(b)
    return va < vb ? -1 : va > vb ? 1 : 0
  })
}

export function truncate(s, limit) {
  if (s.length > limit) {
    s = s.substring(0, limit) + '…'
  }
  return s
}
