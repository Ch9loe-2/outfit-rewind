import exifr from 'exifr'
import type { PhotoRow } from './db'

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
  GPSLatitude?: number
  GPSLongitude?: number
  ExifImageWidth?: number
  ExifImageHeight?: number
  ImageWidth?: number
  ImageHeight?: number
}

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  let exif: ExifShape | null = null
  try {
    exif = (await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
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

  const hasGps =
    exif &&
    typeof exif.GPSLatitude === 'number' &&
    typeof exif.GPSLongitude === 'number' &&
    Number.isFinite(exif.GPSLatitude) &&
    Number.isFinite(exif.GPSLongitude)

  return {
    id: hashId(file),
    takenAt,
    takenAtSource: taken ? 'exif' : 'mtime',
    lat: hasGps ? (exif!.GPSLatitude as number) : undefined,
    lon: hasGps ? (exif!.GPSLongitude as number) : undefined,
    geoSource: hasGps ? 'exif' : 'none',
    width: (exif && (exif.ExifImageWidth || exif.ImageWidth)) || 0,
    height: (exif && (exif.ExifImageHeight || exif.ImageHeight)) || 0,
    mime: file.type || 'image/jpeg',
    bytes: file.size,
  }
}

export async function makeThumb(file: File, max = 200): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
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
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.62)
    })
    if (blob) return blob
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.65))
  } catch {
    return null
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
