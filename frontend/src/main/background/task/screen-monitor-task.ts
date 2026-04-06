import { ScreenSettings } from './../../../renderer/src/store/setting';
import { CaptureSource } from '@interface/common/source'
import { IpcServerPushChannel } from '@shared/ipc-server-push-channel'
import { BrowserWindow, ipcMain } from 'electron'
import { get, pick, uniqBy } from 'lodash'
import screenshotService from '../../services/ScreenshotService'
import { AutoRefreshCache } from './cache-value'
import { getLogger } from '@shared/logger/main'
import PQueue from 'p-queue'
import axios from 'axios'
import { getBackendPort } from '@main/backend'
import dayjs, { Dayjs } from 'dayjs'
import { IpcChannel } from '@shared/IpcChannel'
import { powerWatcher } from '../os/Power'
import isBetween from 'dayjs/plugin/isBetween'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { ScheduleNextTask } from './schedule-next-task'
import MacInputMonitorService, { InputTriggerEvent } from '../../services/MacInputMonitorService'
import {
  createInitialInputTriggerState,
  evaluateInputTriggerEvent,
  type CaptureTriggerType,
  type InputTriggerConfig
} from './input-trigger-policy'

dayjs.extend(isBetween)
dayjs.extend(customParseFormat)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
const queue = new PQueue({ concurrency: 3 })

const logger = getLogger('ScreenMonitorTask')
type ScreenshotTriggerType = 'interval' | CaptureTriggerType

class ScreenMonitorTask extends ScheduleNextTask {
  static globalStatus: 'running' | 'stopped' = 'stopped'
  private status: 'running' | 'stopped' = 'stopped'
  private appInfo: CaptureSource[] = []
  private configCache: AutoRefreshCache<CaptureSource[]> | null = null
  private modelConfig: Partial<ScreenSettings> = {}
  private inputMonitorService = new MacInputMonitorService()
  private leftClickCount = 0
  private lastLeftClickCaptureAt = 0
  private lastEnterCaptureAt = 0
  private captureBatchInFlight = false
  private readonly inputMonitorListener = (event: InputTriggerEvent) => {
    void this.handleInputTrigger(event)
  }

  constructor() {
    super()
    this.inputMonitorService.onEvent(this.inputMonitorListener)
  }
  public async init() {
    this.listenToScreenMonitorEvents()
    this.configCache = new AutoRefreshCache<CaptureSource[]>({
      fetchFn: async () => {
        return await this.getVisibleSourcesUseCache()
      },
      interval: 3 * 1000,
      immediate: true
    })
    logger.info('ScreenMonitorTask initialized')
  }
  private listenToScreenMonitorEvents() {
    ipcMain.handle(IpcChannel.Task_Update_Current_Record_App, (_, appInfo: CaptureSource[]) => {
      logger.info(
        'ScreenMonitorTask updateCurrentRecordApp -->',
        appInfo.map((v) => pick(v, ['name', 'type']))
      )
      this.appInfo = uniqBy([...this.appInfo, ...appInfo], 'id')
      this.configCache?.triggerUpdate(true)
    })
    ipcMain.handle(IpcChannel.Task_Update_Model_Config, (_, config: ScreenSettings) => {
      this.modelConfig = config
      this.updateInterval(config.recordInterval * 1000)
    })
    ipcMain.handle(IpcChannel.Task_Start, () => {
      logger.info('render notify ScreenMonitorTask start')
      ScreenMonitorTask.globalStatus = 'running'
      this.startTask()
    })
    ipcMain.handle(IpcChannel.Task_Stop, () => {
      logger.info('render notify ScreenMonitorTask stop')
      ScreenMonitorTask.globalStatus = 'stopped'
      this.stopTask()
    })
    ipcMain.handle(IpcChannel.Task_Check_Can_Record, () => {
      return {
        canRecord: this.checkCanRecord(),
        status: this.status
      }
    })
    powerWatcher.registerResumeCallback(() => {
      logger.info('ScreenMonitorTask resume')
      if (ScreenMonitorTask.globalStatus === 'running') {
        this.startTask()
      }
    })
    powerWatcher.registerSuspendCallback(() => {
      logger.info('ScreenMonitorTask suspend')
      this.stopTask()
    })
    powerWatcher.registerLockScreenCallback(() => {
      logger.info('ScreenMonitorTask lock-screen', ScreenMonitorTask.globalStatus)
      this.stopTask()
    })
    powerWatcher.registerUnlockScreenCallback(() => {
      logger.info('ScreenMonitorTask unlock-screen', ScreenMonitorTask.globalStatus)
      if (ScreenMonitorTask.globalStatus === 'running') {
        this.startTask()
      }
    })
  }
  private async startTask() {
    if (this.status === 'running') {
      return
    }
    if (!this.hasEnabledCaptureTrigger()) {
      logger.warn('screen monitor start skipped because no capture trigger is enabled')
      return
    }

    logger.info('ScreenMonitorTask startTask', this.configCache)
    this.configCache?.start()
    if (this.shouldRunIntervalCapture()) {
      this.scheduleNextTask(true, async () => this.captureSelectedVisibleSources('interval'))
    }
    if (this.shouldListenInputTrigger()) {
      this.inputMonitorService.start()
    }
    this.status = 'running'
    this.broadcastStatus()
  }
  private stopTask() {
    if (this.status === 'stopped') {
      return
    }
    logger.info('ScreenMonitorTask stopTask')
    this.configCache?.stop()
    this.stopScheduleNextTask()
    this.inputMonitorService.stop()
    this.resetInputTriggerState()
    this.captureBatchInFlight = false
    this.status = 'stopped'
    this.broadcastStatus()
    // clear queue
    queue.clear()
  }

  private async getVisibleSourcesUseCache() {
    try {
      const res = await screenshotService.getVisibleSources()
      logger.info('getVisibleSourcesUseCache', res)
      if (res.sources) {
        return res.sources
      } else {
        return []
      }
    } catch (error) {
      logger.error('getVisibleSourcesUseCache error', error)
      return []
    }
  }
  private async handleScreenshotTask(source: CaptureSource, createTime: Dayjs, triggerType: ScreenshotTriggerType) {
    const res = await screenshotService.takeScreenshot(source.id, createTime)

    if (res.success) {
      logger.info(`Screenshot taken successfully for source ${source.id}`)
      const url = get(res, 'screenshotInfo.url') || ''
      if (url) {
        await this.uploadImage(url, source.type, createTime, triggerType)
      }
    } else {
      throw new Error(res.error || 'Unknown error')
    }
  }

  private async captureSelectedVisibleSources(triggerType: ScreenshotTriggerType) {
    if (this.captureBatchInFlight) {
      logger.debug('skip capture because previous batch is still running', { triggerType })
      return
    }

    this.captureBatchInFlight = true
    try {
      const visibleSources = this.configCache?.get()
      logger.debug(
        'visibleSources',
        visibleSources?.map((item) => pick(item, ['name', 'type', 'isVisible']))
      )
      const ids = visibleSources?.map((item) => (item.isVisible ? item.id : '')).filter(Boolean) || []
      if (!visibleSources || ids.length === 0) {
        logger.warn('screen monitor visibleSources is empty')
        return
      }
      if (!this.checkCanRecord()) {
        logger.warn('screen monitor not in record time')
        return
      }

      const sources = this.appInfo.filter((source) => ids.includes(source.id))
      if (sources.length === 0) {
        logger.warn('screen monitor sources is empty')
        return
      }
      logger.debug(
        'sources',
        sources.map((v) => pick(v, ['name', 'type']))
      )
      const createTime = dayjs()
      const taskResults = await Promise.allSettled(
        sources.map((source) => queue.add(() => this.handleScreenshotTask(source, createTime, triggerType)))
      )
      const failedCount = taskResults.filter((result) => result.status === 'rejected').length
      logger.info('Screenshot batch completed', { triggerType, sourceCount: sources.length })
      if (failedCount > 0) {
        logger.warn('Screenshot batch finished with failures', { triggerType, failedCount })
      }
    } catch (error) {
      this.stopTask()
      logger.error('captureSelectedVisibleSources error', error)
    } finally {
      this.captureBatchInFlight = false
    }
  }

  private async handleInputTrigger(event: InputTriggerEvent) {
    try {
      if (this.status !== 'running') {
        return
      }
      if (this.captureBatchInFlight) {
        return
      }
      if (!this.checkCanRecord()) {
        return
      }

      const result = evaluateInputTriggerEvent({
        state: this.getInputTriggerState(),
        config: this.getInputTriggerConfig(),
        eventType: event.type,
        nowMs: event.timestamp
      })
      this.applyInputTriggerState(result.state)

      if (result.shouldCapture && result.captureTriggerType) {
        await this.captureSelectedVisibleSources(result.captureTriggerType)
      }
    } catch (error) {
      logger.error('handleInputTrigger error', error)
    }
  }

  private broadcastStatus() {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(IpcServerPushChannel.PushScreenMonitorStatus, this.status)
    })
  }

  public unregister() {
    queue.clear()
    this.configCache?.destroy()
    this.status = 'stopped'
    this.stopScheduleNextTask()
    this.inputMonitorService.stop()
    this.inputMonitorService.offEvent(this.inputMonitorListener)

    ipcMain.removeHandler(IpcChannel.Task_Update_Model_Config)
    ipcMain.removeHandler(IpcChannel.Task_Start)
    ipcMain.removeHandler(IpcChannel.Task_Stop)
    ipcMain.removeHandler(IpcChannel.Task_Update_Current_Record_App)
  }

  private async uploadImage(
    url: string,
    type: CaptureSource['type'],
    createTime: Dayjs,
    triggerType: ScreenshotTriggerType
  ) {
    try {
      const data = {
        path: url,
        window: type === 'screen' ? 'screen' : '',
        create_time: createTime.format('YYYY-MM-DD HH:mm:ss'),
        app: type === 'window' ? 'window' : '',
        trigger_type: triggerType
      }
      const res = await axios.post(`http://127.0.0.1:${getBackendPort()}/api/add_screenshot`, data)
      if (res.status === 200) {
        logger.info('Screenshot uploaded successfully')
      } else {
        logger.error('Screenshot upload failed', res.status)
      }
    } catch (error) {
      logger.error('Failed to upload screenshot:', error)
    }
  }

  private checkCanRecord = () => {
    const { enableRecordingHours, applyToDays, recordingHours } = this.modelConfig

    if (!enableRecordingHours) {
      return true
    }

    const now = dayjs()

    if (applyToDays === 'weekday') {
      const currentDay = now.day()
      if (currentDay === 0 || currentDay === 6) {
        return false
      }
    }

    if (recordingHours && Array.isArray(recordingHours) && recordingHours.length === 2) {
      const [startTimeStr, endTimeStr] = recordingHours as [string, string] // e.g., ["09:00", "18:00"]

      const start = dayjs(startTimeStr, 'HH:mm')
      const end = dayjs(endTimeStr, 'HH:mm')

      if (!start.isValid() || !end.isValid()) {
        logger.warn(`invalid record time format: ${startTimeStr}-${endTimeStr}。skip check`)
        return true
      }

      if (start.isAfter(end)) {
        return now.isSameOrAfter(start) || now.isSameOrBefore(end)
      } else {
        return now.isBetween(start, end, null, '[]')
      }
    }
    return true
  }

  private shouldRunIntervalCapture() {
    return this.modelConfig.intervalEnabled !== false
  }

  private shouldListenInputTrigger() {
    return !!this.modelConfig.enableLeftClickCapture || !!this.modelConfig.enableEnterCapture
  }

  private hasEnabledCaptureTrigger() {
    return this.shouldRunIntervalCapture() || this.shouldListenInputTrigger()
  }

  private getInputTriggerConfig(): InputTriggerConfig {
    return {
      enableLeftClickCapture: !!this.modelConfig.enableLeftClickCapture,
      leftClickThreshold: this.modelConfig.leftClickThreshold ?? 50,
      leftClickCooldownSeconds: this.modelConfig.leftClickCooldownSeconds ?? 60,
      enableEnterCapture: !!this.modelConfig.enableEnterCapture,
      enterCooldownSeconds: this.modelConfig.enterCooldownSeconds ?? 60
    }
  }

  private getInputTriggerState() {
    return {
      leftClickCount: this.leftClickCount,
      lastLeftClickCaptureAt: this.lastLeftClickCaptureAt,
      lastEnterCaptureAt: this.lastEnterCaptureAt
    }
  }

  private applyInputTriggerState(state: ReturnType<typeof createInitialInputTriggerState>) {
    this.leftClickCount = state.leftClickCount
    this.lastLeftClickCaptureAt = state.lastLeftClickCaptureAt
    this.lastEnterCaptureAt = state.lastEnterCaptureAt
  }

  private resetInputTriggerState() {
    this.applyInputTriggerState(createInitialInputTriggerState())
  }
}
export { ScreenMonitorTask }
