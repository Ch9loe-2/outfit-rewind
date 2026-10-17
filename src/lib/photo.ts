import type { PhotoRow } from './db'

type ExifrModule = typeof import('exifr')['default']
let exifrPromise: Promise<ExifrModule> | null = null

/** exifr 体积不小，只有导入时才需要，放到动态 chunk 里 */
function loadExifr(): Promise<ExifrModule> {
  if (!exifrPromise) exifrPromise = import('exifr').then((mod) => mod.default)
  return exifrPromise
}

export interface PhotoMeta {
  id: string
  takenAt: number
  takenAtSource: 'exif' | 'mtime'
  lat?: number
  lon?: number
  geoSource: 'exif' | 'none'
  width: number
  height: number
  mime: string
  bytes: number
}

export function hashId(file: File): string {
  const raw = file.name + '|' + String(file.size) + '|' + String(file.lastModified)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

interface ExifShape {
  DateTimeOriginal?: Date
  CreateDate?: Date
  ModifyDate?: Date
  latitude?: number
  longitude?: number
  GPSLatitude?: number | number[]
  GPSLongitude?: number | number[]
  GPSLatitudeRef?: string
  GPSLongitudeRef?: string
  ExifImageWidth?: number
  ExifImageHeight?: number
  ImageWidth?: number
  ImageHeight?: number
}

/** exifr 给出的可能是十进制，也可能是 [度, 分, 秒] */
function toDecimal(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value) && value.length === 3) {
    const [d, m, s] = value.map((item) => Number(item))
    if ([d, m, s].every((item) => Number.isFinite(item))) return d + m / 60 + s / 3600
  }
  return undefined
}

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  let exif: ExifShape | null = null
  try {
    const exifr = await loadExifr()
    exif = (await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'latitude',
        'longitude',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'ExifImageWidth',
        'ExifImageHeight',
        'ImageWidth',
        'ImageHeight',
      ],
      gps: true,
    })) as ExifShape | null
  } catch {
    exif = null
  }

  const taken = exif && (exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate)
  const takenAt = taken ? new Date(taken).getTime() : Math.min(file.lastModified || Date.now(), Date.now())

  let lat = exif ? toDecimal(exif.latitude) ?? toDecimal(exif.GPSLatitude) : undefined
  let lon = exif ? toDecimal(exif.longitude) ?? toDecimal(exif.GPSLongitude) : undefined

  if (typeof lat === 'number' && exif?.GPSLatitudeRef === 'S') lat = -Math.abs(lat)
  if (typeof lon === 'number' && exif?.GPSLongitudeRef === 'W') lon = -Math.abs(lon)

  const hasGps =
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    !(lat === 0 && lon === 0)

  return {
    id: hashId(file),
    takenAt,
    takenAtSource: taken ? 'exif' : 'mtime',
    lat: hasGps ? lat : undefined,
    lon: hasGps ? lon : undefined,
    geoSource: hasGps ? 'exif' : 'none',
    width: (exif && (exif.ExifImageWidth || exif.ImageWidth)) || 0,
    height: (exif && (exif.ExifImageHeight || exif.ImageHeight)) || 0,
    mime: file.type || 'image/jpeg',
    bytes: file.size,
  }
}

async function drawThumb(source: ImageBitmapSource, max: number): Promise<Blob | null> {
  const bitmap = await createImageBitmap(source)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const webp = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.62)
  })
  if (webp) return webp
  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.65))
}

function looksHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

export async function makeThumb(file: File, max = 200): Promise<Blob | null> {
  try {
    return await drawThumb(file, max)
  } catch {
    // Safari 能直接解 HEIC，Chrome 不行：退回到 wasm 解码（按需加载）
    if (!looksHeic(file)) return null
    try {
      const mod = await import('heic2any')
      const converted = await mod.default({ blob: file, toType: 'image/jpeg', quality: 0.8 })
      const single = Array.isArray(converted) ? converted[0] : converted
      return await drawThumb(single, max)
    } catch {
      return null
    }
  }
}

export function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|heic|heif|webp|gif|avif|tiff?)$/i.test(file.name)
}

export function toPhotoRow(meta: PhotoMeta, dayKey: string, importedAt: number, source: 'folder' | 'picker'): PhotoRow {
  return {
    id: meta.id,
    dayKey,
    takenAt: meta.takenAt,
    takenAtSource: meta.takenAtSource,
    lat: meta.lat,
    lon: meta.lon,
    geoSource: meta.geoSource,
    width: meta.width,
    height: meta.height,
    mime: meta.mime,
    bytes: meta.bytes,
    importedAt,
    source,
  }
}
