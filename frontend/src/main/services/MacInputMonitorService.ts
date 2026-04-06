import { ChildProcess, spawn, spawnSync } from 'child_process'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { getLogger } from '@shared/logger/main'
import { InputTriggerEvent, parseInputMonitorMessage } from './mac-input-monitor-protocol'

const logger = getLogger('MacInputMonitorService')
export type { InputTriggerEvent } from './mac-input-monitor-protocol'

type InputTriggerListener = (event: InputTriggerEvent) => void

class MacInputMonitorService {
  private childProcess: ChildProcess | null = null
  private stdoutReader: readline.Interface | null = null
  private listeners = new Set<InputTriggerListener>()

  public onEvent(listener: InputTriggerListener) {
    this.listeners.add(listener)
  }

  public offEvent(listener: InputTriggerListener) {
    this.listeners.delete(listener)
  }

  public isRunning() {
    return !!this.childProcess && !this.childProcess.killed
  }

  public start() {
    if (process.platform !== 'darwin') {
      logger.info('Skip starting input monitor on non-macOS platform')
      return
    }

    if (this.isRunning()) {
      return
    }

    const helperPath = this.resolveHelperPath()
    if (!helperPath || !fs.existsSync(helperPath)) {
      logger.error('Input monitor helper not found', { helperPath })
      return
    }

    logger.info('Starting macOS input monitor helper', { helperPath })
    const childProcess = spawn(helperPath, [], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.childProcess = childProcess
    if (!childProcess.stdout || !childProcess.stderr) {
      logger.error('Input monitor stdio is not available')
      this.cleanup()
      return
    }
    this.stdoutReader = readline.createInterface({
      input: childProcess.stdout
    })

    this.stdoutReader.on('line', (line) => {
      const message = parseInputMonitorMessage(line)
      if (!message || message.kind !== 'event') {
        return
      }
      this.listeners.forEach((listener) => listener(message.event))
    })

    childProcess.stderr.on('data', (chunk) => {
      logger.warn('Input monitor stderr', { output: chunk.toString().trim() })
    })

    childProcess.on('exit', (code, signal) => {
      logger.warn('Input monitor exited', { code, signal })
      this.cleanup()
    })

    childProcess.on('error', (error) => {
      logger.error('Input monitor failed to start', error)
      this.cleanup()
    })
  }

  public stop() {
    if (!this.childProcess) {
      return
    }

    logger.info('Stopping macOS input monitor helper')
    this.childProcess.kill('SIGTERM')
    this.cleanup()
  }

  private cleanup() {
    this.stdoutReader?.close()
    this.stdoutReader = null
    this.childProcess = null
  }

  private resolveHelperPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin', 'input_monitor')
    }

    const candidates = [
      path.join(app.getAppPath(), 'externals', 'mac_input_monitor', 'dist', 'input_monitor'),
      path.join(process.cwd(), 'externals', 'mac_input_monitor', 'dist', 'input_monitor'),
      path.join(process.cwd(), 'frontend', 'externals', 'mac_input_monitor', 'dist', 'input_monitor')
    ]

    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]
  }

  public static checkPermission() {
    return this.runPermissionCommand('--check-permission')
  }

  public static requestPermission() {
    return this.runPermissionCommand('--request-permission')
  }

  private static runPermissionCommand(command: '--check-permission' | '--request-permission') {
    if (process.platform !== 'darwin') {
      return false
    }

    const helperPath = new MacInputMonitorService().resolveHelperPath()
    if (!helperPath || !fs.existsSync(helperPath)) {
      logger.error('Input monitor helper not found when checking permission', { helperPath, command })
      return false
    }

    const result = spawnSync(helperPath, [command], {
      encoding: 'utf8'
    })

    if (result.error) {
      logger.error('Failed to execute input monitor helper command', { command, error: result.error })
      return false
    }

    const lines = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      const message = parseInputMonitorMessage(line)
      if (message?.kind === 'permission-status') {
        return message.granted
      }
    }

    logger.warn('Input monitor helper did not return permission status', {
      command,
      status: result.status,
      stderr: result.stderr.trim()
    })
    return false
  }
}

export default MacInputMonitorService
