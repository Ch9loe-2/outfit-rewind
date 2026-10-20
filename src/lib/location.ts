export interface Coords {
  lat: number
  lon: number
}

export interface GeoError extends Error {
  code?: number
}

const MESSAGES: Record<number, string> = {
  1: '定位权限被拒绝',
  2: '暂时拿不到位置',
  3: '定位超时',
}

function getPosition(options: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const error = new Error(MESSAGES[err.code] ?? '定位失败') as GeoError
        error.code = err.code
        reject(error)
      },
      options,
    )
  })
}

/**
 * 定位分两步：先快速要一个粗略位置（缓存也认），超时或不可用再要一次高精度。
 * iOS 首次定位冷启动经常 10 秒以上，原来 8 秒就放弃，太急了。
 */
export async function currentPosition(): Promise<Coords> {
  if (!('geolocation' in navigator)) {
    throw new Error('这个浏览器不支持定位')
  }

  try {
    return await getPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 })
  } catch (err) {
    const error = err as GeoError
    if (error.code === 2 || error.code === 3) {
      return await getPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
    }
    throw error
  }
}
