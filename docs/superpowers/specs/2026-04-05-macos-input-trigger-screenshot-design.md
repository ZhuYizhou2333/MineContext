# macOS 输入触发截屏设计说明

## 目标

为 MineContext 的 Screen Monitor 增加两种 macOS 输入触发截屏能力，并保留现有的定时截屏能力：

1. 用户全局左键点击累计达到阈值时触发一次截屏。
2. 用户全局按下 Enter 键时触发一次截屏。

同时新增前端设置项，允许用户独立启用或关闭各触发器，并调整阈值和冷却时间。左键与 Enter 触发器默认冷却时间均为 60 秒，且支持修改。

## 范围

本次仅要求 macOS 落地，不扩展 Windows 或 Linux。

包含内容：

1. 主进程新增全局输入监听能力。
2. Screen Monitor 截图调度器扩展为支持事件触发。
3. 前端设置页新增触发器配置项和辅助功能权限提示。
4. 构建与打包链路新增 macOS 输入监听 helper。
5. 后端截图入库链路增加触发来源元数据。

不包含内容：

1. 跨平台输入监听抽象。
2. 输入事件明细持久化。
3. 更复杂的节流策略，例如窗口变化检测、智能去重。

## 现状

当前截屏由 Electron 主进程中的定时轮询任务驱动：

1. 渲染层在启动录制时，将 `recordInterval` 等配置通过 IPC 传入主进程。
2. `ScreenMonitorTask` 使用 `ScheduleNextTask` 按秒级轮询执行截图。
3. 每轮根据当前可见 source 和录制时段判断是否可录制。
4. 截图最终由 `ScreenshotService` 完成，并上传 Python 后端入库。

当前不存在全局键盘或鼠标事件监听能力。项目里只有 macOS 辅助功能权限的 IPC 封装，可作为新能力的权限基础。

## 方案选择

### 方案 A：在 Electron 主进程内直接引入原生 Node Hook 库

优点：

1. 事件监听代码集中在 TypeScript 中。
2. 看起来接入路径较短。

缺点：

1. 与 Electron 版本和打包环境的兼容风险较高。
2. 原生依赖升级成本高。
3. 对 Apple Silicon、签名和发布链路更敏感。

### 方案 B：新增独立 macOS helper，通过 stdout 向主进程推送输入事件

优点：

1. 与 Electron 主进程解耦，维护边界清晰。
2. 更容易控制权限申请、重启和异常恢复。
3. 对现有截图链路侵入较小。

缺点：

1. 需要补一段 macOS 原生代码和构建脚本。
2. 打包资源需要新增 helper。

### 方案 C：轮询系统输入状态

优点：

1. 看似简单。

缺点：

1. 无法稳定统计左键点击次数。
2. 无法可靠检测全局 Enter 按下事件。
3. 会引入高频轮询和误判。

推荐采用方案 B。

## 总体设计

### 1. 触发器模型

在现有 `ScreenSettings` 基础上扩展以下配置：

```ts
{
  intervalEnabled: true,
  recordInterval: 15,
  enableLeftClickCapture: false,
  leftClickThreshold: 50,
  leftClickCooldownSeconds: 60,
  enableEnterCapture: false,
  enterCooldownSeconds: 60,
  enableRecordingHours: false,
  recordingHours: ['08:00:00', '20:00:00'],
  applyToDays: 'weekday'
}
```

设计原则：

1. 定时触发器和输入触发器互相独立。
2. 用户可以仅启用输入触发器，关闭定时截屏。
3. 左键和 Enter 冷却时间单独配置。
4. 冷却时间单位统一使用秒，减少前后端换算歧义。

### 2. 输入监听架构

新增一个 macOS helper，可执行文件名统一为 `input_monitor`。

职责：

1. 使用 `CGEventTap` 监听全局 `leftMouseDown`。
2. 使用 `CGEventTap` 监听全局 `keyDown`。
3. 对 Return 键和小键盘 Enter 键输出统一事件。
4. 使用 stdout 按 NDJSON 输出事件流。

输出格式：

```json
{"type":"mouse:left-down","timestamp":1710000000000}
{"type":"key:enter-down","timestamp":1710000001234}
```

主进程新增 `MacInputMonitorService`：

1. 负责启动和关闭 helper。
2. 解析 stdout 事件流。
3. 在 helper 退出时记录日志并允许后续重启。
4. 对外暴露 `onEvent` 订阅接口。

### 3. 截图调度架构

`ScreenMonitorTask` 仍然是唯一截图调度中心，不允许输入 helper 直接触发截图。

重构方式：

1. 抽出通用方法，例如 `captureSelectedVisibleSources(triggerType)`。
2. 定时调度和输入事件都调用该通用方法。
3. 继续复用现有 `ScreenshotService`、上传逻辑、录制时间校验和 source 过滤逻辑。

新增状态：

1. `leftClickCount`：当前累计左键次数。
2. `lastLeftClickCaptureAt`：上次左键触发截屏时间。
3. `lastEnterCaptureAt`：上次 Enter 触发截屏时间。
4. `captureBatchInFlight`：当前是否已有一批截图任务正在启动。

规则：

1. 不在录制状态时忽略所有输入事件。
2. 超出录制时段时忽略所有输入事件。
3. 左键在冷却期间不累计。
4. 左键达到阈值后立即触发一次截屏并重置计数。
5. Enter 在冷却期间直接忽略。
6. 若有批量截图正在执行，新的触发请求直接跳过，避免批次重叠。

### 4. 前端设置设计

在 Screen Monitor 设置弹窗新增 “Capture Triggers” 区域，包含：

1. `Enable interval capture`
2. `Interval seconds`
3. `Enable left click capture`
4. `Left click threshold`
5. `Left click cooldown`
6. `Enable Enter capture`
7. `Enter cooldown`
8. `Accessibility permission status`
9. `Grant permission` 按钮

交互规则：

1. 若未开启辅助功能权限，左键和 Enter 开关可点击，但保存时需明确提示权限缺失。
2. 用户可以先保存配置，再点击授权。
3. 若仅启用定时截屏，则无需辅助功能权限。
4. 至少要启用一种触发方式，否则提示无法开始录制。

### 5. 权限设计

macOS 需要两类权限：

1. 屏幕录制权限：现有截图功能已依赖。
2. 辅助功能权限：本次新增输入监听依赖。

现有 `App_MacIsProcessTrusted` 与 `App_MacRequestProcessTrust` 可直接复用，用于：

1. 页面初始化时读取辅助功能权限状态。
2. 在设置弹窗内展示权限状态。
3. 用户点击按钮后拉起系统授权提示。

### 6. 后端元数据设计

为后端截图入口新增 `trigger_type` 字段，建议取值：

1. `interval`
2. `left_click`
3. `enter`

收益：

1. 后续排查截图来源更容易。
2. 活动分析可区分定时样本和输入驱动样本。
3. 后续如需做噪声分析或触发策略优化，有据可查。

## 代码边界

### 前端与配置

1. `frontend/src/renderer/src/store/setting.ts`
2. `frontend/src/renderer/src/hooks/use-setting.ts`
3. `frontend/src/renderer/src/pages/screen-monitor/screen-monitor.tsx`
4. `frontend/src/renderer/src/pages/screen-monitor/components/settings-modal.tsx`
5. `frontend/src/renderer/src/types/electron.d.ts`
6. `frontend/src/preload/index.ts`

### 主进程

1. `frontend/src/main/background/task/screen-monitor-task.ts`
2. `frontend/src/main/background/task/schedule-next-task.ts`
3. `frontend/src/main/ipc.ts`
4. `frontend/packages/shared/IpcChannel.ts`
5. `frontend/src/main/services/MacInputMonitorService.ts`（新增）

### macOS helper 与构建

1. `frontend/externals/mac_input_monitor/input_monitor.swift`（新增）
2. `frontend/scripts/build-mac-input-monitor.js`（新增）
3. `frontend/package.json`
4. `frontend/electron-builder.yml`

### 后端

1. `opencontext/server/routes/screenshots.py`
2. `opencontext/server/opencontext.py`
3. `opencontext/server/context_operations.py`

## 风险与应对

### 1. 辅助功能权限未授予

风险：

1. helper 无法收到全局输入事件。

应对：

1. 前端显示权限状态。
2. 启用输入触发器时做显式校验和提示。
3. 定时截屏不受影响。

### 2. 输入事件过于频繁

风险：

1. 用户大量按 Enter 或快速点击可能导致截屏过密。

应对：

1. 引入独立冷却时间。
2. 批次进行中不再重复启动新的截图批次。

### 3. helper 异常退出

风险：

1. 输入触发器失效但页面未感知。

应对：

1. 主进程记录退出日志。
2. 在录制启动时重新拉起 helper。
3. 后续可扩展为推送 helper 状态到前端，但本次不是必须项。

## 验证标准

满足以下条件视为需求完成：

1. 在 macOS 上启用左键截屏后，累计左键达到阈值时会截屏一次。
2. 左键触发后，冷却时间内继续点击不会再次触发，也不会继续累计。
3. 在 macOS 上启用 Enter 截屏后，按下 Enter 会触发一次截屏。
4. Enter 触发后，冷却时间内重复按 Enter 不会再次触发。
5. 定时截屏仍可独立使用，且与输入触发器可同时开启。
6. 锁屏、暂停录制或超出录制时段时，输入事件不会触发截屏。
7. 设置项可持久化，并在重新打开页面后正确恢复。
8. 后端能记录 `trigger_type`。

## 非目标

以下内容明确不在本轮需求中：

1. Windows/Linux 输入触发截屏。
2. 对所有键盘键做自定义映射。
3. 针对不同应用配置不同阈值。
4. 根据前台窗口内容变化决定是否跳过截图。
