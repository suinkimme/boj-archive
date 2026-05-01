// Structured logging — emits one JSON object per console line so
// Vercel function logs stay searchable. No external dependency yet;
// upgrade to a SaaS by parsing the same shape on ingest.

type Payload = Record<string, unknown>

export function logEvent(event: string, data: Payload = {}): void {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }))
}

export function logError(event: string, data: Payload = {}): void {
  console.error(
    JSON.stringify({ event, ts: new Date().toISOString(), ...data }),
  )
}
