import { Gunzip, gzipSync as compress } from 'fflate'

export const constants = { Z_BEST_COMPRESSION: 9, Z_BEST_SPEED: 1, Z_DEFAULT_COMPRESSION: -1 }
interface Options {
  level?: number
  maxOutputLength?: number
}
export const gzipSync = (input: Uint8Array, options: Options = {}): Uint8Array => {
  const level = options.level === -1 ? 6 : options.level
  const result = compress(input, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | undefined })
  if (result.length > (options.maxOutputLength ?? Infinity)) throw new Error('gzip output limit exceeded')
  return result
}
export const gunzipSync = (input: Uint8Array, options: Options = {}): Uint8Array => {
  const chunks: Uint8Array[] = []
  let length = 0
  const decoder = new Gunzip((chunk) => {
    length += chunk.length
    if (length > (options.maxOutputLength ?? Infinity)) throw new Error('gunzip output limit exceeded')
    chunks.push(chunk)
  })
  for (let offset = 0; offset < input.length; offset += 1024) {
    decoder.push(input.subarray(offset, offset + 1024), offset + 1024 >= input.length)
  }
  if (!input.length) decoder.push(input, true)
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
