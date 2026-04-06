// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState, useAppDispatch } from '@renderer/store'
import { ApplyToDays, setScreenSettings as setScreenSettingsAction } from '@renderer/store/setting'

export const useSetting = () => {
  const dispatch = useAppDispatch()
  const screenSettings = useSelector((state: RootState) => state.setting.screenSettings)

  const {
    intervalEnabled,
    recordInterval,
    enableLeftClickCapture,
    leftClickThreshold,
    leftClickCooldownSeconds,
    enableEnterCapture,
    enterCooldownSeconds,
    recordingHours,
    enableRecordingHours,
    applyToDays
  } = screenSettings

  const setIntervalEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setScreenSettingsAction({ intervalEnabled: enabled }))
    },
    [dispatch]
  )

  const setRecordInterval = useCallback(
    (interval: number) => {
      dispatch(setScreenSettingsAction({ recordInterval: interval }))
    },
    [dispatch]
  )

  const setEnableRecordingHours = useCallback(
    (enable: boolean) => {
      dispatch(setScreenSettingsAction({ enableRecordingHours: enable }))
    },
    [dispatch]
  )

  const setRecordingHours = useCallback(
    (hours: [string, string]) => {
      dispatch(setScreenSettingsAction({ recordingHours: hours }))
    },
    [dispatch]
  )

  const setApplyToDays = useCallback(
    (days: ApplyToDays) => {
      dispatch(setScreenSettingsAction({ applyToDays: days }))
    },
    [dispatch]
  )

  const setEnableLeftClickCapture = useCallback(
    (enable: boolean) => {
      dispatch(setScreenSettingsAction({ enableLeftClickCapture: enable }))
    },
    [dispatch]
  )

  const setLeftClickThreshold = useCallback(
    (threshold: number) => {
      dispatch(setScreenSettingsAction({ leftClickThreshold: threshold }))
    },
    [dispatch]
  )

  const setLeftClickCooldownSeconds = useCallback(
    (cooldownSeconds: number) => {
      dispatch(setScreenSettingsAction({ leftClickCooldownSeconds: cooldownSeconds }))
    },
    [dispatch]
  )

  const setEnableEnterCapture = useCallback(
    (enable: boolean) => {
      dispatch(setScreenSettingsAction({ enableEnterCapture: enable }))
    },
    [dispatch]
  )

  const setEnterCooldownSeconds = useCallback(
    (cooldownSeconds: number) => {
      dispatch(setScreenSettingsAction({ enterCooldownSeconds: cooldownSeconds }))
    },
    [dispatch]
  )

  return {
    intervalEnabled,
    recordInterval,
    enableLeftClickCapture,
    leftClickThreshold,
    leftClickCooldownSeconds,
    enableEnterCapture,
    enterCooldownSeconds,
    recordingHours,
    enableRecordingHours,
    applyToDays,
    setIntervalEnabled,
    setRecordInterval,
    setEnableLeftClickCapture,
    setLeftClickThreshold,
    setLeftClickCooldownSeconds,
    setEnableEnterCapture,
    setEnterCooldownSeconds,
    setEnableRecordingHours,
    setRecordingHours,
    setApplyToDays
  }
}
