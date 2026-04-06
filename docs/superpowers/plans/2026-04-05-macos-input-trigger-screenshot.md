# macOS 输入触发截屏功能 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MineContext 的 Screen Monitor 增加 macOS 全局左键点击与 Enter 按键触发截屏能力，并支持前端配置启用状态、阈值和冷却时间。

**Architecture:** 保留现有 Electron 主进程截图链路不变，在主进程外新增一个 macOS 输入监听 helper，通过 stdout 向主进程发送输入事件。`ScreenMonitorTask` 统一接收定时触发和输入触发，复用已有截图、上传和录制时间判断逻辑，并将触发来源传递给后端。

**Tech Stack:** Electron 37、TypeScript、React、Arco Design、macOS `CGEventTap` helper、Python FastAPI 后端。

---

## Chunk 1: 配置模型与 IPC 边界

### Task 1: 扩展录制设置模型

**Files:**
- Modify: `frontend/src/renderer/src/store/setting.ts`
- Modify: `frontend/src/renderer/src/hooks/use-setting.ts`

- [ ] **Step 1: 扩展默认设置与类型**

在 `frontend/src/renderer/src/store/setting.ts` 中为 `defaultScreenSettings` 和 `ScreenSettings` 增加：

```ts
intervalEnabled: true,
enableLeftClickCapture: false,
leftClickThreshold: 50,
leftClickCooldownSeconds: 60,
enableEnterCapture: false,
enterCooldownSeconds: 60
```

- [ ] **Step 2: 在 hook 中暴露 getter / setter**

在 `frontend/src/renderer/src/hooks/use-setting.ts` 中补充：

```ts
setIntervalEnabled
setEnableLeftClickCapture
setLeftClickThreshold
setLeftClickCooldownSeconds
setEnableEnterCapture
setEnterCooldownSeconds
```

- [ ] **Step 3: 运行类型检查**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run typecheck`

Expected: 仅出现与本任务无关的既有错误，或类型检查通过。

### Task 2: 扩展渲染层与预加载层类型

**Files:**
- Modify: `frontend/src/preload/index.ts`
- Modify: `frontend/src/renderer/src/types/electron.d.ts`
- Modify: `frontend/packages/shared/IpcChannel.ts`
- Modify: `frontend/src/main/ipc.ts`

- [ ] **Step 1: 为辅助功能权限补充清晰的前端接口**

在 `frontend/src/preload/index.ts` 中增加：

```ts
macIsProcessTrusted: () => ipcRenderer.invoke(IpcChannel.App_MacIsProcessTrusted),
macRequestProcessTrust: () => ipcRenderer.invoke(IpcChannel.App_MacRequestProcessTrust)
```

如果已有同类接口，则统一整理到 `screenMonitorAPI` 或 `api`，避免页面层绕过类型系统。

- [ ] **Step 2: 更新类型声明**

在 `frontend/src/renderer/src/types/electron.d.ts` 中为新接口补充返回值声明。

- [ ] **Step 3: 确认 IPC 枚举与主进程处理器已可用**

若无需新增 `IpcChannel` 枚举值，则仅在计划执行时补充注释；若要新增 helper 状态查询或测试入口，则在 `frontend/packages/shared/IpcChannel.ts` 与 `frontend/src/main/ipc.ts` 一并补齐。

- [ ] **Step 4: 运行类型检查**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run typecheck`

Expected: 新增接口没有类型报错。

## Chunk 2: macOS 输入监听 helper

### Task 3: 新增 macOS 输入监听可执行文件

**Files:**
- Create: `frontend/externals/mac_input_monitor/input_monitor.swift`
- Create: `frontend/scripts/build-mac-input-monitor.js`
- Modify: `frontend/package.json`
- Modify: `frontend/electron-builder.yml`

- [ ] **Step 1: 编写 Swift helper**

在 `frontend/externals/mac_input_monitor/input_monitor.swift` 中实现：

1. 使用 `CGEventTap` 监听 `leftMouseDown` 和 `keyDown`。
2. 将 Return 与 keypad Enter 都映射为 `key:enter-down`。
3. 通过 stdout 输出 NDJSON。
4. 收到 `SIGTERM` 时优雅退出。

输出示例：

```json
{"type":"mouse:left-down","timestamp":1710000000000}
{"type":"key:enter-down","timestamp":1710000001234}
```

- [ ] **Step 2: 编写构建脚本**

在 `frontend/scripts/build-mac-input-monitor.js` 中实现：

1. 仅在 `process.platform === 'darwin'` 时执行。
2. 使用 `xcrun swiftc` 或 `swiftc` 编译 `input_monitor.swift`。
3. 将输出放到 `frontend/externals/mac_input_monitor/dist/input_monitor`。
4. 构建前检查命令是否存在，缺失时给出清晰错误。

- [ ] **Step 3: 接入 npm 构建流程**

在 `frontend/package.json` 中补一条脚本，并将其挂入现有 `build` 或 `build:externals` 流程，例如：

```json
"build:mac-input-monitor": "node scripts/build-mac-input-monitor.js"
```

macOS 构建链路需确保 helper 在打包前已生成。

- [ ] **Step 4: 接入 electron-builder**

在 `frontend/electron-builder.yml` 的 `mac.extraResources` 中追加：

```yml
- from: externals/mac_input_monitor/dist/input_monitor
  to: bin/input_monitor
```

- [ ] **Step 5: 验证 helper 可执行文件构建**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run build:mac-input-monitor`

Expected: `frontend/externals/mac_input_monitor/dist/input_monitor` 存在并可执行。

## Chunk 3: 主进程输入监听服务

### Task 4: 新增 MacInputMonitorService

**Files:**
- Create: `frontend/src/main/services/MacInputMonitorService.ts`

- [ ] **Step 1: 实现 helper 进程管理**

在 `frontend/src/main/services/MacInputMonitorService.ts` 中实现：

1. `start()`：启动 helper。
2. `stop()`：关闭 helper。
3. `restart()`：异常恢复时使用。
4. `isRunning()`：返回当前进程状态。

- [ ] **Step 2: 实现事件订阅接口**

定义统一事件类型：

```ts
type InputTriggerEvent =
  | { type: 'mouse:left-down'; timestamp: number }
  | { type: 'key:enter-down'; timestamp: number }
```

提供：

```ts
onEvent(listener)
offEvent(listener)
```

- [ ] **Step 3: 实现 stdout 解析与容错**

要求：

1. 按行解析 NDJSON。
2. 非法 JSON 行只记日志，不导致服务崩溃。
3. helper 异常退出时记录 exit code 和 stderr。

- [ ] **Step 4: 运行类型检查**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run typecheck`

Expected: 新服务类型正确，路径解析无报错。

## Chunk 4: 截图调度器接入输入触发

### Task 5: 重构 ScreenMonitorTask 的统一截图入口

**Files:**
- Modify: `frontend/src/main/background/task/screen-monitor-task.ts`
- Modify: `frontend/src/main/background/task/schedule-next-task.ts`

- [ ] **Step 1: 抽出统一截图方法**

将当前 `startScreenMonitor()` 中的截图逻辑重构为：

```ts
private async captureSelectedVisibleSources(
  triggerType: 'interval' | 'left_click' | 'enter'
)
```

方法内部继续复用：

1. 可见 source 过滤
2. `checkCanRecord()`
3. `handleScreenshotTask()`
4. 上传逻辑

- [ ] **Step 2: 为定时触发器增加总开关**

在 `Task_Update_Model_Config` 收到配置后支持：

1. `intervalEnabled === true` 时保留当前轮询。
2. `intervalEnabled === false` 时不启动 `ScheduleNextTask`。

若输入触发器开启，则录制状态依旧允许开始，只是不启动定时器。

- [ ] **Step 3: 增加输入触发状态**

在 `ScreenMonitorTask` 中新增：

```ts
private leftClickCount = 0
private lastLeftClickCaptureAt = 0
private lastEnterCaptureAt = 0
private captureBatchInFlight = false
```

- [ ] **Step 4: 接入输入事件处理逻辑**

实现：

```ts
private async handleInputTrigger(event: InputTriggerEvent)
```

规则：

1. 非录制状态直接返回。
2. 未启用对应触发器直接返回。
3. 不在录制时段直接返回。
4. 左键冷却期间不累计。
5. 左键达到阈值时触发截屏并清零。
6. Enter 冷却期间直接忽略。
7. 有批次进行中时忽略新触发。

- [ ] **Step 5: 绑定 MacInputMonitorService**

在任务启动和停止时：

1. 如果启用了输入触发器，则启动 helper。
2. 如果未启用输入触发器，则不启动 helper。
3. 停止录制时确保 helper 停止并重置计数状态。

- [ ] **Step 6: 运行类型检查**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run typecheck`

Expected: 无新增类型错误。

## Chunk 5: 前端设置页

### Task 6: 在设置弹窗中增加触发器配置项

**Files:**
- Modify: `frontend/src/renderer/src/pages/screen-monitor/components/settings-modal.tsx`
- Modify: `frontend/src/renderer/src/pages/screen-monitor/screen-monitor.tsx`

- [ ] **Step 1: 扩展页面临时状态**

在 `frontend/src/renderer/src/pages/screen-monitor/screen-monitor.tsx` 中增加临时 state：

```ts
tempIntervalEnabled
tempEnableLeftClickCapture
tempLeftClickThreshold
tempLeftClickCooldownSeconds
tempEnableEnterCapture
tempEnterCooldownSeconds
tempIsAccessibilityTrusted
```

- [ ] **Step 2: 新增设置表单控件**

在 `frontend/src/renderer/src/pages/screen-monitor/components/settings-modal.tsx` 中增加：

1. 定时截屏开关
2. 左键截屏开关
3. 左键阈值输入框
4. 左键冷却输入框
5. Enter 截屏开关
6. Enter 冷却输入框
7. 辅助功能权限状态展示
8. 授权按钮

输入建议：

1. 阈值使用 `InputNumber`
2. 冷却使用 `InputNumber`
3. 对阈值和冷却设置最小值，例如 `1`

- [ ] **Step 3: 增加保存前校验**

保存设置时校验：

1. 至少启用一种触发方式。
2. 若启用了左键或 Enter，但无辅助功能权限，则提示用户先授权。
3. 阈值和冷却必须大于 0。

- [ ] **Step 4: 将新配置传入启动录制接口**

在 `startMonitoring()` 的 `updateModelConfig()` 调用中传入所有新增配置。

- [ ] **Step 5: 运行类型检查**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run typecheck`

Expected: 页面可编译，新增 props 类型正确。

## Chunk 6: 后端触发来源透传

### Task 7: 为截图入库增加 trigger_type

**Files:**
- Modify: `frontend/src/main/background/task/screen-monitor-task.ts`
- Modify: `opencontext/server/routes/screenshots.py`
- Modify: `opencontext/server/opencontext.py`
- Modify: `opencontext/server/context_operations.py`

- [ ] **Step 1: 扩展上传 payload**

在 `frontend/src/main/background/task/screen-monitor-task.ts` 的上传参数中增加：

```ts
trigger_type: 'interval' | 'left_click' | 'enter'
```

- [ ] **Step 2: 扩展后端请求模型**

在 `opencontext/server/routes/screenshots.py` 中为 `AddScreenshotRequest` 增加 `trigger_type` 字段，并向后传递。

- [ ] **Step 3: 扩展 OpenContext 与 ContextOperations**

在 `opencontext/server/opencontext.py` 与 `opencontext/server/context_operations.py` 中透传该字段，并写入截图 `additional_info`。

- [ ] **Step 4: 运行后端基础校验**

Run: `cd /Users/zhuyizhou/MineContext && python -m py_compile opencontext/server/routes/screenshots.py opencontext/server/opencontext.py opencontext/server/context_operations.py`

Expected: 命令退出码为 0。

## Chunk 7: 最终验证

### Task 8: 联调与手工验证

**Files:**
- No code changes

- [ ] **Step 1: 前端类型检查**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run typecheck`

Expected: 退出码为 0，或仅存在与本功能无关的既有错误并已记录。

- [ ] **Step 2: 前端 lint**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run lint`

Expected: 新增文件无 lint 错误。

- [ ] **Step 3: helper 构建验证**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run build:mac-input-monitor`

Expected: helper 成功生成。

- [ ] **Step 4: 手工验证场景**

依次验证：

1. 仅开启定时截屏，录制正常。
2. 关闭定时，仅开启左键，累计 50 次触发一次。
3. 左键触发后 60 秒内继续点击不会再次触发。
4. 关闭定时，仅开启 Enter，按下 Enter 会触发。
5. Enter 触发后 60 秒内继续按 Enter 不会再次触发。
6. 三个触发器同时开启时互不冲突。
7. 锁屏、停止录制、非录制时段时不再触发。
8. 关闭并重新打开应用后，设置值正确恢复。
9. 无辅助功能权限时，输入触发器无法正常启用并显示明确提示。

- [ ] **Step 5: 如需打包验证**

Run: `cd /Users/zhuyizhou/MineContext/frontend && npm run build:mac`

Expected: `bin/input_monitor` 被正确打入 mac 包内资源目录。

## 实施备注

1. 当前仓库未看到成熟的前端自动化测试基础设施，本计划以类型检查、lint 和手工验证为主。
2. 若执行过程中发现 `ScreenMonitorTask` 过于臃肿，可在不扩大范围的前提下，将输入触发相关逻辑拆到独立 helper 类中，但不要做无关重构。
3. 若 `swiftc` 在开发机不可用，按仓库约定使用 `brew` 安装所需工具。
