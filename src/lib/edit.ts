import { db } from './db'
import { rebuildDays } from './importer'

/** 把某一天的所有照片挪到另一天（如果目标已有照片，会合并） */
export async function moveDay(from: string, to: string): Promise<number> {
  if (from === to) return 0
  const photos = await db.photos.where('dayKey').equals(from).toArray()
  if (!photos.length) return 0

  await db.transaction('rw', db.photos, async () => {
    for (const photo of photos) {
      await db.photos.update(photo.id, { dayKey: to })
    }
  })

  await rebuildDays()
  return photos.length
}

/** 删除某一天：照片索引 + 缩略图 + 穿搭日记录（天气缓存保留） */
export async function deleteDay(date: string): Promise<number> {
  const photos = await db.photos.where('dayKey').equals(date).toArray()
  const ids = photos.map((photo) => photo.id)

  await db.transaction('rw', db.photos, db.thumbs, db.days, async () => {
    if (ids.length) {
      await db.photos.bulkDelete(ids)
      await db.thumbs.bulkDelete(ids)
    }
    await db.days.delete(date)
  })

  return ids.length
}
