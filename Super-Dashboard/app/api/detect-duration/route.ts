import { NextRequest, NextResponse } from "next/server"

const CHUNK = 524288 // 512 KB

// MP4 stores duration in the 'mvhd' (movie header) atom.
function findMvhd(buf: Buffer): { timescale: number; duration: number } | null {
  const sig = Buffer.from("mvhd")
  for (let i = 0; i <= buf.length - 32; i++) {
    if (buf[i] !== sig[0] || !buf.subarray(i, i + 4).equals(sig)) continue
    const version = buf[i + 4]
    if (version === 0) {
      // creation(4) + modification(4) + timescale(4) + duration(4)
      const timescale = buf.readUInt32BE(i + 12)
      const duration = buf.readUInt32BE(i + 16)
      if (timescale > 0) return { timescale, duration }
    } else if (version === 1) {
      // creation(8) + modification(8) + timescale(4) + duration(8)
      const timescale = buf.readUInt32BE(i + 20)
      const duration = Number(buf.readBigUInt64BE(i + 24))
      if (timescale > 0) return { timescale, duration }
    }
  }
  return null
}

// Normalize well-known cloud storage share links into direct download URLs.
function toDirectUrl(raw: string): string {
  try {
    const u = new URL(raw)

    // Google Drive: /file/d/FILE_ID/view → uc?export=download&id=FILE_ID&confirm=t
    const gdMatch = u.pathname.match(/\/file\/d\/([^/]+)/)
    if (u.hostname === "drive.google.com" && gdMatch) {
      return `https://drive.google.com/uc?export=download&id=${gdMatch[1]}&confirm=t`
    }

    // Dropbox: dl=0 → dl=1 (or raw=1)
    if (u.hostname.includes("dropbox.com")) {
      u.searchParams.set("dl", "1")
      return u.toString()
    }

    // OneDrive share links: add &download=1
    if (u.hostname.includes("1drv.ms") || u.hostname.includes("onedrive.live.com")) {
      u.searchParams.set("download", "1")
      return u.toString()
    }
  } catch {}
  return raw
}

// Stream only the first CHUNK bytes — works even when the server ignores Range.
async function streamHead(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${CHUNK - 1}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok && res.status !== 206) return null
    if (!res.body) return Buffer.from(await res.arrayBuffer())

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < CHUNK) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      total += value.length
    }
    reader.cancel().catch(() => {})
    const full = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    return full.subarray(0, CHUNK)
  } catch {
    return null
  }
}

// Fetch the tail of a file via Range (only works when server honours Range).
async function fetchTail(url: string, contentLength: number): Promise<Buffer | null> {
  const start = Math.max(0, contentLength - CHUNK)
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=${start}-${contentLength - 1}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status !== 206) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")
  if (!raw) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  const url = toDirectUrl(raw)

  // HEAD to get content-length (needed for tail fallback)
  let contentLength: number | null = null
  try {
    const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8_000) })
    const cl = head.headers.get("content-length")
    if (cl) contentLength = Number(cl)
  } catch {}

  // Try first 512 KB (covers fast-start MP4s — moov at the front)
  const headBuf = await streamHead(url)
  if (headBuf) {
    const result = findMvhd(headBuf)
    if (result) {
      return NextResponse.json({ duration: Math.round(result.duration / result.timescale) })
    }
  }

  // moov at the end (non-fast-start). Try last 512 KB via Range.
  if (contentLength && contentLength > CHUNK) {
    const tail = await fetchTail(url, contentLength)
    if (tail) {
      const result = findMvhd(tail)
      if (result) {
        return NextResponse.json({ duration: Math.round(result.duration / result.timescale) })
      }
    }
  }

  return NextResponse.json(
    {
      error:
        "Could not extract duration. The video may not be a standard MP4, or moov metadata was not in the first/last 512 KB of the file. Try encoding with -movflags faststart, or enter the duration manually.",
    },
    { status: 422 },
  )
}
