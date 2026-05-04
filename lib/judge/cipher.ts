// Hidden testcase 입력값을 서버 → 브라우저 전송 시 가리는 AES-GCM 암호화.
// Web Crypto API를 사용해 서버(Node 20+)와 클라이언트(브라우저) 양쪽에서
// 동일하게 동작한다.
//
// 키는 NEXT_PUBLIC_JUDGE_INPUT_KEY env (32바이트 hex)로 관리. NEXT_PUBLIC_은
// 빌드 타임에 클라이언트 번들에 인라인되므로 *진짜 비밀이 아님*. obfuscation
// 목적: "Network 탭 한 번에 평문 보임" → "번들 분석 필요" 수준으로 난이도 상승.
// 키 회전·환경별 분리 등 운영 편의를 위해 env로 분리.
//
// 진짜 비공개를 원한다면 서버 측 코드 실행 인프라가 필요 (현 아키텍처 결정상
// 도입하지 않음).

function readKeyHex(): string {
  const v = process.env.NEXT_PUBLIC_JUDGE_INPUT_KEY
  if (!v || !/^[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error(
      'NEXT_PUBLIC_JUDGE_INPUT_KEY env must be a 32-byte hex string (64 chars). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  return v
}

const KEY_HEX = readKeyHex()

export interface EncryptedPayload {
  ciphertext: string // base64
  iv: string // base64
}

let cachedKey: Promise<CryptoKey> | null = null

function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey
  cachedKey = crypto.subtle.importKey(
    'raw',
    toArrayBuffer(hexToBytes(KEY_HEX)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
  return cachedKey
}

export async function encryptString(plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getKey()
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(plaintext)),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
  }
}

export async function decryptString(
  payload: EncryptedPayload,
): Promise<string> {
  const iv = base64ToBytes(payload.iv)
  const ct = base64ToBytes(payload.ciphertext)
  const key = await getKey()
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct),
  )
  return new TextDecoder().decode(pt)
}

// Web Crypto API의 BufferSource 타입은 Uint8Array<ArrayBuffer>를 요구하지만
// `new Uint8Array(...)`는 기본 시그니처가 Uint8Array<ArrayBufferLike>라 TS 충돌.
// 새 ArrayBuffer로 옮겨 담아 호환성 확보.
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buf).set(bytes)
  return buf
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}
