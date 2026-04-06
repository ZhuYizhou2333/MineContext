export type InputTriggerEvent =
  | { type: 'mouse:left-down'; timestamp: number }
  | { type: 'key:enter-down'; timestamp: number }

export type InputMonitorMessage =
  | {
      kind: 'event'
      event: InputTriggerEvent
    }
  | {
      kind: 'permission-status'
      granted: boolean
    }

export function parseInputMonitorMessage(line: string): InputMonitorMessage | null {
  if (!line.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(line)

    if (
      (parsed.type === 'mouse:left-down' || parsed.type === 'key:enter-down') &&
      typeof parsed.timestamp === 'number'
    ) {
      return {
        kind: 'event',
        event: parsed as InputTriggerEvent
      }
    }

    if (parsed.type === 'permission-status' && typeof parsed.granted === 'boolean') {
      return {
        kind: 'permission-status',
        granted: parsed.granted
      }
    }

    return null
  } catch {
    return null
  }
}
