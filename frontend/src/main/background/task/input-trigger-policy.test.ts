import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createInitialInputTriggerState,
  evaluateInputTriggerEvent,
  type InputTriggerConfig
} from './input-trigger-policy.ts'

const baseConfig: InputTriggerConfig = {
  enableLeftClickCapture: true,
  leftClickThreshold: 3,
  leftClickCooldownSeconds: 60,
  enableEnterCapture: true,
  enterCooldownSeconds: 60
}

test('left click reaches threshold and triggers capture', () => {
  let state = createInitialInputTriggerState()

  let result = evaluateInputTriggerEvent({
    state,
    config: baseConfig,
    eventType: 'mouse:left-down',
    nowMs: 1000
  })
  assert.equal(result.shouldCapture, false)
  assert.equal(result.state.leftClickCount, 1)
  state = result.state

  result = evaluateInputTriggerEvent({
    state,
    config: baseConfig,
    eventType: 'mouse:left-down',
    nowMs: 2000
  })
  assert.equal(result.shouldCapture, false)
  assert.equal(result.state.leftClickCount, 2)
  state = result.state

  result = evaluateInputTriggerEvent({
    state,
    config: baseConfig,
    eventType: 'mouse:left-down',
    nowMs: 3000
  })
  assert.equal(result.shouldCapture, true)
  assert.equal(result.captureTriggerType, 'left_click')
  assert.equal(result.state.leftClickCount, 0)
  assert.equal(result.state.lastLeftClickCaptureAt, 3000)
})

test('left click does not accumulate during cooldown', () => {
  const state = {
    leftClickCount: 0,
    lastLeftClickCaptureAt: 1000,
    lastEnterCaptureAt: 0
  }

  const result = evaluateInputTriggerEvent({
    state,
    config: baseConfig,
    eventType: 'mouse:left-down',
    nowMs: 1000 + 30_000
  })

  assert.equal(result.shouldCapture, false)
  assert.equal(result.state.leftClickCount, 0)
  assert.equal(result.reason, 'left_click_cooldown')
})

test('enter key respects cooldown and triggers after cooldown ends', () => {
  const state = {
    leftClickCount: 0,
    lastLeftClickCaptureAt: 0,
    lastEnterCaptureAt: 10_000
  }

  const blocked = evaluateInputTriggerEvent({
    state,
    config: baseConfig,
    eventType: 'key:enter-down',
    nowMs: 50_000
  })
  assert.equal(blocked.shouldCapture, false)
  assert.equal(blocked.reason, 'enter_cooldown')

  const allowed = evaluateInputTriggerEvent({
    state,
    config: baseConfig,
    eventType: 'key:enter-down',
    nowMs: 71_000
  })
  assert.equal(allowed.shouldCapture, true)
  assert.equal(allowed.captureTriggerType, 'enter')
  assert.equal(allowed.state.lastEnterCaptureAt, 71_000)
})

test('disabled trigger types are ignored', () => {
  const result = evaluateInputTriggerEvent({
    state: createInitialInputTriggerState(),
    config: {
      ...baseConfig,
      enableLeftClickCapture: false,
      enableEnterCapture: false
    },
    eventType: 'mouse:left-down',
    nowMs: 1000
  })

  assert.equal(result.shouldCapture, false)
  assert.equal(result.reason, 'trigger_disabled')
})
