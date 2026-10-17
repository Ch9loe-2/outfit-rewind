import { useEffect, useState } from 'react'
import { db } from './db'

export function useThumb(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    if (!id) {
      setUrl(null)
      return
    }

    db.thumbs
      .get(id)
      .then((row) => {
        if (cancelled || !row) return
        objectUrl = URL.createObjectURL(row.blob)
        setUrl(objectUrl)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  return url
}
