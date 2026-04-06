// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ApplyToDays = 'weekday' | 'everyday'

export const defaultScreenSettings = {
  intervalEnabled: true,
  recordInterval: 15,
  enableLeftClickCapture: false,
  leftClickThreshold: 50,
  leftClickCooldownSeconds: 60,
  enableEnterCapture: false,
  enterCooldownSeconds: 60,
  enableRecordingHours: false,
  recordingHours: ['08:00:00', '20:00:00'] as [string, string],
  applyToDays: 'weekday' as ApplyToDays
};

export type ScreenSettings = typeof defaultScreenSettings;

const initialState = {
  screenSettings: defaultScreenSettings
  // other settings...
}

const settingSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setScreenSettings(state, action: PayloadAction<Partial<ScreenSettings>>) {
      state.screenSettings = { ...state.screenSettings, ...action.payload }
    }
  }
})

export const { setScreenSettings } = settingSlice.actions

export default settingSlice.reducer
