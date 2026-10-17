import { describe, expect, it } from 'vitest'
import { createZip, readZip } from './zip'

describe('zip', () => {
  it('写入后能读回来，内容和顺序一致', () => {
    const entries = [
      { name: 'backup.json', data: new TextEncoder().encode('{"a":1}') },
      { name: 'thumbs/abc.webp', data: new Uint8Array([1, 2, 3, 4, 5]) },
    ]
    const bytes = createZip(entries, new Date('2026-10-17T12:00:00Z'))
    const round = readZip(bytes.buffer)
    expect(round.map((entry) => entry.name)).toEqual(['backup.json', 'thumbs/abc.webp'])
    expect(new TextDecoder().decode(round[0].data)).toBe('{"a":1}')
    expect(Array.from(round[1].data)).toEqual([1, 2, 3, 4, 5])
  })

  it('空包也能读', () => {
    expect(readZip(createZip([]).buffer)).toEqual([])
  })

  it('非 zip 数据报错', () => {
    expect(() => readZip(new Uint8Array([1, 2, 3, 4]).buffer)).toThrow()
  })
})
