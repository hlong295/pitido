// Minimal TOTP utilities (RFC 6238) for PITODO.
// No external dependencies.

import crypto from "crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ""

  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes))
}

export function buildOtpAuthUri(params: {
  secret: string
  label: string
  issuer: string
}): string {
  const issuer = encodeURIComponent(params.issuer)
  const label = encodeURIComponent(params.label)
  const secret = params.secret
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

export function verifyTotpCode(secret: string, code: string, window = 1): boolean {
  const normalized = String(code || "").replace(/\s+/g, "")
  if (!/^[0-9]{6}$/.test(normalized)) return false

  const key = base32Decode(secret)
  const step = 30
  const now = Math.floor(Date.now() / 1000)
  const counter = Math.floor(now / step)

  for (let w = -window; w <= window; w++) {
    const c = counter + w
    const msg = Buffer.alloc(8)
    msg.writeBigUInt64BE(BigInt(c), 0)

    const hmac = crypto.createHmac("sha1", key).update(msg).digest()
    const offset = hmac[hmac.length - 1] & 0x0f
    const binCode =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    const otp = (binCode % 1_000_000).toString().padStart(6, "0")
    if (otp === normalized) return true
  }
  return false
}

export function generateBackupCodes(count = 8): string[] {
  // 8 codes, format: XXXX-XXXX
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase() // 8 hex
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`)
  }
  return codes
}
