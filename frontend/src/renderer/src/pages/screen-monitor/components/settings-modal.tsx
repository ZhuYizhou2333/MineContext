import React from 'react'
import {
  Button,
  Modal,
  Slider,
  TimePicker,
  Radio,
  Form,
  Checkbox,
  Spin,
  Switch,
  InputNumber,
  Typography
} from '@arco-design/web-react'
import clsx from 'clsx'
import { Application } from './application'
import screenIcon from '@renderer/assets/icons/screen.svg'
import { ApplyToDays } from '@renderer/store/setting'

const { Text } = Typography

interface SettingsModalProps {
  visible: boolean
  form: any
  sources: any
  screenAllSources: any[]
  appAllSources: any[]
  applicationVisible: boolean
  tempIntervalEnabled: boolean
  tempRecordInterval: number
  tempEnableLeftClickCapture: boolean
  tempLeftClickThreshold: number
  tempLeftClickCooldownSeconds: number
  tempEnableEnterCapture: boolean
  tempEnterCooldownSeconds: number
  tempEnableRecordingHours: boolean
  tempRecordingHours: [string, string]
  tempApplyToDays: string
  isInputMonitoringTrusted: boolean
  onCancel: () => void
  onSave: () => void
  onRequestInputMonitoringPermission: () => void
  onSetApplicationVisible: (visible: boolean) => void
  onSetTempIntervalEnabled: (value: boolean) => void
  onSetTempRecordInterval: (value: number) => void
  onSetTempEnableLeftClickCapture: (value: boolean) => void
  onSetTempLeftClickThreshold: (value: number) => void
  onSetTempLeftClickCooldownSeconds: (value: number) => void
  onSetTempEnableEnterCapture: (value: boolean) => void
  onSetTempEnterCooldownSeconds: (value: number) => void
  onSetTempEnableRecordingHours: (value: boolean) => void
  onSetTempRecordingHours: (value: [string, string]) => void
  onSetTempApplyToDays: (value: ApplyToDays) => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  form,
  sources,
  screenAllSources,
  appAllSources,
  applicationVisible,
  tempIntervalEnabled,
  tempRecordInterval,
  tempEnableLeftClickCapture,
  tempLeftClickThreshold,
  tempLeftClickCooldownSeconds,
  tempEnableEnterCapture,
  tempEnterCooldownSeconds,
  tempEnableRecordingHours,
  tempRecordingHours,
  tempApplyToDays,
  isInputMonitoringTrusted,
  onCancel,
  onSave,
  onRequestInputMonitoringPermission,
  onSetApplicationVisible,
  onSetTempIntervalEnabled,
  onSetTempRecordInterval,
  onSetTempEnableLeftClickCapture,
  onSetTempLeftClickThreshold,
  onSetTempLeftClickCooldownSeconds,
  onSetTempEnableEnterCapture,
  onSetTempEnterCooldownSeconds,
  onSetTempEnableRecordingHours,
  onSetTempRecordingHours,
  onSetTempApplyToDays
}) => {
  return (
    <Modal
      title="Settings"
      visible={visible}
      autoFocus={false}
      focusLock
      onCancel={onCancel}
      className="text-[#AEAFC2]"
      unmountOnExit
      footer={
        <>
          <Button onClick={onCancel} className="[&_.arco-btn]: !text-xs">
            Cancel
          </Button>
          <Button type="primary" onClick={onSave} className="[&_.arco-btn-primary]: !bg-black">
            Save
          </Button>
        </>
      }
      style={{ width: 760 }}>
      <Form layout="vertical" form={form}>
        <div className="flex w-full flex-1 mt-5">
          <div className="flex flex-col flex-1 pr-[24px]">
            <div className="pb-4 border-b border-[#efeff4]">
              <div className="text-[15px] leading-[18px] text-[#42464e] mb-[12px] font-medium">Capture Triggers</div>
              <Form.Item label="Enable interval capture" className="[&_.arco-form-item-label]:!text-xs !mb-2">
                <Switch
                  checked={tempIntervalEnabled}
                  onChange={onSetTempIntervalEnabled}
                  className={!tempIntervalEnabled ? '[&_.arco-switch]: !bg-[#e2e3ef]' : '[&_.arco-switch]: !bg-black'}
                />
              </Form.Item>
              <Form.Item label="Record Interval" className="[&_.arco-form-item-label]:!text-xs">
                <Slider
                  value={tempRecordInterval}
                  onChange={(value) => onSetTempRecordInterval(value as number)}
                  min={5}
                  max={300}
                  disabled={!tempIntervalEnabled}
                  marks={{
                    5: '5s',
                    300: '5min'
                  }}
                  className="!mt-4"
                  formatTooltip={(value) => `${value}s`}
                />
              </Form.Item>
              <Form.Item label="Enable left click capture" className="[&_.arco-form-item-label]:!text-xs !mb-2">
                <Switch
                  checked={tempEnableLeftClickCapture}
                  onChange={onSetTempEnableLeftClickCapture}
                  className={
                    !tempEnableLeftClickCapture ? '[&_.arco-switch]: !bg-[#e2e3ef]' : '[&_.arco-switch]: !bg-black'
                  }
                />
              </Form.Item>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Form.Item label="Left click threshold" className="[&_.arco-form-item-label]:!text-xs !mb-0">
                  <InputNumber
                    min={1}
                    disabled={!tempEnableLeftClickCapture}
                    value={tempLeftClickThreshold}
                    onChange={(value) => onSetTempLeftClickThreshold(Number(value || 1))}
                  />
                </Form.Item>
                <Form.Item label="Left click cooldown (s)" className="[&_.arco-form-item-label]:!text-xs !mb-0">
                  <InputNumber
                    min={1}
                    disabled={!tempEnableLeftClickCapture}
                    value={tempLeftClickCooldownSeconds}
                    onChange={(value) => onSetTempLeftClickCooldownSeconds(Number(value || 1))}
                  />
                </Form.Item>
              </div>
              <Form.Item label="Enable Enter capture" className="[&_.arco-form-item-label]:!text-xs !mb-2">
                <Switch
                  checked={tempEnableEnterCapture}
                  onChange={onSetTempEnableEnterCapture}
                  className={
                    !tempEnableEnterCapture ? '[&_.arco-switch]: !bg-[#e2e3ef]' : '[&_.arco-switch]: !bg-black'
                  }
                />
              </Form.Item>
              <Form.Item label="Enter cooldown (s)" className="[&_.arco-form-item-label]:!text-xs !mb-0">
                <InputNumber
                  min={1}
                  disabled={!tempEnableEnterCapture}
                  value={tempEnterCooldownSeconds}
                  onChange={(value) => onSetTempEnterCooldownSeconds(Number(value || 1))}
                />
              </Form.Item>
              <div className="mt-4 p-3 rounded-[8px] bg-[#f7f8fb]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] text-[#0b0b0f]">Input Monitoring Permission</div>
                    <Text type={isInputMonitoringTrusted ? 'success' : 'secondary'}>
                      {isInputMonitoringTrusted ? 'Granted' : 'Required for left click and Enter capture'}
                    </Text>
                  </div>
                  <Button type="outline" size="small" onClick={onRequestInputMonitoringPermission}>
                    Grant Permission
                  </Button>
                </div>
              </div>
            </div>

            <Form.Item label="Choose what to record" shouldUpdate className="mt-4">
              {(values) => {
                const { screenSources = [], windowSources = [] } = values || {}
                const screenList = screenAllSources?.filter((source) => screenSources.includes(source.id)) || []
                const windowList = appAllSources?.filter((source) => windowSources.includes(source.id)) || []
                return (
                  <Spin loading={sources.state === 'loading'} block>
                    <Application
                      value={[...screenList, ...windowList]}
                      onCancel={() => onSetApplicationVisible(false)}
                      visible={applicationVisible}
                      onOk={() => onSetApplicationVisible(true)}
                    />
                  </Spin>
                )
              }}
            </Form.Item>
            <Form.Item label="Enable recording hours" className="[&_.arco-form-item-label]:!text-xs !mb-0">
              <Switch
                checked={tempEnableRecordingHours}
                onChange={onSetTempEnableRecordingHours}
                className={
                  !tempEnableRecordingHours ? '[&_.arco-switch]: !bg-[#e2e3ef]' : '[&_.arco-switch]: !bg-black'
                }
              />
            </Form.Item>
            {tempEnableRecordingHours && (
              <div className="!mt-3">
                <Form.Item label="Set recording hours" className="[&_.arco-form-item-label]:!text-xs">
                  <TimePicker.RangePicker
                    format="HH:mm"
                    value={tempRecordingHours}
                    onChange={(value) => onSetTempRecordingHours(value as [string, string])}
                  />
                </Form.Item>
                <Form.Item label="Apply to days" className="[&_.arco-form-item-label]: !text-xs">
                  <Radio.Group value={tempApplyToDays} onChange={onSetTempApplyToDays}>
                    <Radio value="weekday" className="[&_.arco-radio-mask]: !border-[#d7daea]">
                      Only weekday
                    </Radio>
                    <Radio value="everyday" className="[&_.arco-radio-mask]: !border-[#d7daea]">
                      Everyday
                    </Radio>
                  </Radio.Group>
                </Form.Item>
              </div>
            )}
          </div>
          <div
            className={clsx(
              'flex flex-col flex-1 border-l border-[#efeff4] max-h-[360px] h-[360px] overflow-x-hidden overflow-y-auto px-[16px]  [&_.arco-checkbox-checked_.arco-checkbox-mask]:!bg-[#000000] [&_.arco-checkbox-checked_.arco-checkbox-mask]:!border-[#000000]',
              { hidden: !applicationVisible }
            )}>
            <div className="text-[15px] leading-[18px] text-[#42464e] mb-[12px] font-medium">Choose what to record</div>
            <div className="[&_.arco-checkbox]:!flex [&_.arco-checkbox]:!items-center">
              <div className="text-[14px] leading-[20px] text-[#42464e] mb-[4px]">Screen</div>
              <Form.Item field="screenSources">
                <Checkbox.Group className="!grid grid-cols-3 gap-4 relative [&_label]:!mr-0 [&_.arco-checkbox-text]:!ml-0">
                  {screenAllSources.map((source) => (
                    <Checkbox key={source.id} value={source.id}>
                      {({ checked }) => {
                        return (
                          <div className="flex flex-col items-center gap-[4px]">
                            <div
                              className={clsx(
                                'w-[94px] h-[60px] min-w-[94px] min-h-[60px] rounded-[8px] overflow-hidden border relative',
                                checked ? 'border-black' : 'border-transparent'
                              )}>
                              <img
                                src={source.thumbnail || ''}
                                alt="thumbnail"
                                className="w-[94px] h-[60px] inline-block object-cover"
                              />
                              <Checkbox checked={checked} className="!absolute !top-[4px] !right-[4px]" />
                            </div>
                            <div className="flex items-center space-x-[4px]">
                              {source.appIcon ? (
                                <img
                                  src={source.appIcon || ''}
                                  alt=""
                                  className="w-[14px] h-[14px] inline-block object-cover"
                                />
                              ) : (
                                <img src={screenIcon} alt="" className="w-[14px] h-[14px] inline-block object-cover" />
                              )}
                              <div className="text-[13px] leading-[22px] text-[#0b0b0f] !ml-[4px] line-clamp-1">
                                {source.name}
                              </div>
                            </div>
                          </div>
                        )
                      }}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </Form.Item>
            </div>
            <div className="[&_.arco-checkbox]:!flex [&_.arco-checkbox]:!items-center">
              <div className="text-[14px] leading-[20px] text-[#42464e] mb-[4px]">Window</div>
              <div className="text-[10px] leading-[12px] text-[#737a87] mb-[4px]">
                Only opened applications can be selected
              </div>
              <Form.Item field="windowSources">
                <Checkbox.Group className="flex flex-col space-y-4">
                  {appAllSources.map((source) => (
                    <Checkbox key={source.id} value={source.id}>
                      <div className="flex items-center space-x-[4px]">
                        <img
                          src={source.appIcon || source.thumbnail || ''}
                          alt=""
                          className="w-[14px] h-[14px] inline-block object-cover"
                        />
                        <div className="text-[13px] leading-[22px] text-[#0b0b0f] !ml-[4px] line-clamp-1">
                          {source.name}
                        </div>
                      </div>
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </Form.Item>
            </div>
          </div>
        </div>
      </Form>
    </Modal>
  )
}

export default SettingsModal
