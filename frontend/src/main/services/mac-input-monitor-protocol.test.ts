import test from 'node:test'
import assert from 'node:assert/strict'

import { parseInputMonitorMessage } from './mac-input-monitor-protocol.ts'

test('解析输入事件消息', () => {
  const event = parseInputMonitorMessage('{"type":"key:enter-down","timestamp":123}')

  assert.deepEqual(event, {
    kind: 'event',
    event: {
      type: 'key:enter-down',
      timestamp: 123
    }
  })
})

test('解析权限状态消息', () => {
  const status = parseInputMonitorMessage('{"type":"permission-status","granted":true}')

  assert.deepEqual(status, {
    kind: 'permission-status',
    granted: true
  })
})

test('忽略未知消息', () => {
  const unknown = parseInputMonitorMessage('{"type":"unknown"}')

  assert.equal(unknown, null)
})
