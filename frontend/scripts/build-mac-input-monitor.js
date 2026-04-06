#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourcePath = path.join(projectRoot, 'externals', 'mac_input_monitor', 'input_monitor.swift')
const outputDir = path.join(projectRoot, 'externals', 'mac_input_monitor', 'dist')
const outputPath = path.join(outputDir, 'input_monitor')

if (process.platform !== 'darwin') {
  console.log('Skipping macOS input monitor build on non-macOS platform.')
  process.exit(0)
}

function resolveSwiftCompiler() {
  const xcrunResult = spawnSync('xcrun', ['--find', 'swiftc'], { encoding: 'utf8' })
  if (xcrunResult.status === 0) {
    return xcrunResult.stdout.trim()
  }

  const swiftcResult = spawnSync('swiftc', ['--version'], { encoding: 'utf8' })
  if (swiftcResult.status === 0) {
    return 'swiftc'
  }

  throw new Error('未找到 swiftc。请先安装 Xcode Command Line Tools。')
}

function resolveMacSdkPath() {
  const sdkResult = spawnSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' })
  if (sdkResult.status === 0) {
    return sdkResult.stdout.trim()
  }

  throw new Error('未找到 macOS SDK 路径，请确认已安装 Xcode Command Line Tools。')
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`未找到输入监听源码：${sourcePath}`)
}

fs.mkdirSync(outputDir, { recursive: true })

const compiler = resolveSwiftCompiler()
const sdkPath = resolveMacSdkPath()
const args = [
  sourcePath,
  '-sdk',
  sdkPath,
  '-o',
  outputPath,
  '-framework',
  'ApplicationServices',
  '-framework',
  'Foundation'
]

console.log(`Building macOS input monitor with ${compiler}`)
execFileSync(compiler, args, { stdio: 'inherit' })
fs.chmodSync(outputPath, 0o755)
console.log(`Built macOS input monitor: ${outputPath}`)
