export type InputTriggerEventType = 'mouse:left-down' | 'key:enter-down'

export type CaptureTriggerType = 'left_click' | 'enter'

export interface InputTriggerConfig {
  enableLeftClickCapture: boolean
  leftClickThreshold: number
  leftClickCooldownSeconds: number
  enableEnterCapture: boolean
  enterCooldownSeconds: number
}

export interface InputTriggerState {
  leftClickCount: number
  lastLeftClickCaptureAt: number
  lastEnterCaptureAt: number
}

export interface EvaluateInputTriggerEventOptions {
  state: InputTriggerState
  config: InputTriggerConfig
  eventType: InputTriggerEventType
  nowMs: number
}

export interface EvaluateInputTriggerEventResult {
  state: InputTriggerState
  shouldCapture: boolean
  captureTriggerType?: CaptureTriggerType
  reason?:
    | 'left_click_cooldown'
    | 'enter_cooldown'
    | 'trigger_disabled'
    | 'below_threshold'
}

export function createInitialInputTriggerState(): InputTriggerState {
  return {
    leftClickCount: 0,
    lastLeftClickCaptureAt: 0,
    lastEnterCaptureAt: 0
  }
}

export function evaluateInputTriggerEvent({
  state,
  config,
  eventType,
  nowMs
}: EvaluateInputTriggerEventOptions): EvaluateInputTriggerEventResult {
  if (eventType === 'mouse:left-down') {
    if (!config.enableLeftClickCapture) {
      return {
        state,
        shouldCapture: false,
        reason: 'trigger_disabled'
      }
    }

    const cooldownMs = Math.max(0, config.leftClickCooldownSeconds) * 1000
    if (state.lastLeftClickCaptureAt > 0 && nowMs - state.lastLeftClickCaptureAt < cooldownMs) {
      return {
        state: {
          ...state,
          leftClickCount: 0
        },
        shouldCapture: false,
        reason: 'left_click_cooldown'
      }
    }

    const nextCount = state.leftClickCount + 1
    const threshold = Math.max(1, config.leftClickThreshold)

    if (nextCount < threshold) {
      return {
        state: {
          ...state,
          leftClickCount: nextCount
        },
        shouldCapture: false,
        reason: 'below_threshold'
      }
    }

    return {
      state: {
        ...state,
        leftClickCount: 0,
        lastLeftClickCaptureAt: nowMs
      },
      shouldCapture: true,
      captureTriggerType: 'left_click'
    }
  }

  if (!config.enableEnterCapture) {
    return {
      state,
      shouldCapture: false,
      reason: 'trigger_disabled'
    }
  }

  const cooldownMs = Math.max(0, config.enterCooldownSeconds) * 1000
  if (state.lastEnterCaptureAt > 0 && nowMs - state.lastEnterCaptureAt < cooldownMs) {
    return {
      state,
      shouldCapture: false,
      reason: 'enter_cooldown'
    }
  }

  return {
    state: {
      ...state,
      lastEnterCaptureAt: nowMs
    },
    shouldCapture: true,
    captureTriggerType: 'enter'
  }
}
