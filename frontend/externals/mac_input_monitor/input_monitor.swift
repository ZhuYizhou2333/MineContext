import Darwin
import ApplicationServices
import Foundation

private let enterKeyCodes: Set<Int64> = [36, 76]
private var eventTapRef: CFMachPort?
private let permissionStatusType = "permission-status"

private enum RunMode {
    case monitor
    case checkPermission
    case requestPermission
}

private func emitPayload(_ payload: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
        return
    }

    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
}

private func emitEvent(_ type: String) {
    emitPayload([
        "type": type,
        "timestamp": Int(Date().timeIntervalSince1970 * 1000)
    ])
}

private func emitPermissionStatus(_ granted: Bool) {
    emitPayload([
        "type": permissionStatusType,
        "granted": granted
    ])
}

private func stopRunLoop() {
    if let eventTapRef {
        CFMachPortInvalidate(eventTapRef)
    }
    CFRunLoopStop(CFRunLoopGetCurrent())
}

private func signalHandler(_ signal: Int32) -> Void {
    _ = signal
    stopRunLoop()
}

private func enableEventTapIfNeeded(_ type: CGEventType) {
    guard let eventTapRef else {
        return
    }

    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        CGEvent.tapEnable(tap: eventTapRef, enable: true)
    }
}

private let callback: CGEventTapCallBack = { _, type, event, _ in
    enableEventTapIfNeeded(type)

    switch type {
    case .leftMouseDown:
        emitEvent("mouse:left-down")
    case .keyDown:
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        if enterKeyCodes.contains(keyCode) {
            emitEvent("key:enter-down")
        }
    default:
        break
    }

    return Unmanaged.passUnretained(event)
}

private func currentPermissionGranted() -> Bool {
    if #available(macOS 10.15, *) {
        return CGPreflightListenEventAccess()
    }

    return AXIsProcessTrusted()
}

private func requestPermissionIfNeeded() -> Bool {
    if #available(macOS 10.15, *) {
        return CGRequestListenEventAccess()
    }

    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    return AXIsProcessTrustedWithOptions(options)
}

private func resolveRunMode() -> RunMode {
    let arguments = CommandLine.arguments

    if arguments.contains("--check-permission") {
        return .checkPermission
    }

    if arguments.contains("--request-permission") {
        return .requestPermission
    }

    return .monitor
}

switch resolveRunMode() {
case .checkPermission:
    emitPermissionStatus(currentPermissionGranted())
    exit(0)
case .requestPermission:
    emitPermissionStatus(requestPermissionIfNeeded())
    exit(0)
case .monitor:
    break
}

if !currentPermissionGranted() {
    FileHandle.standardError.write(Data("Input Monitoring permission is required.\n".utf8))
    exit(1)
}

let eventMask =
    (CGEventMask(1) << CGEventType.leftMouseDown.rawValue) |
    (CGEventMask(1) << CGEventType.keyDown.rawValue) |
    (CGEventMask(1) << CGEventType.tapDisabledByTimeout.rawValue) |
    (CGEventMask(1) << CGEventType.tapDisabledByUserInput.rawValue)

guard let eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(eventMask),
    callback: callback,
    userInfo: nil
) else {
    FileHandle.standardError.write(Data("Failed to create event tap. Input Monitoring permission may be missing.\n".utf8))
    exit(1)
}

eventTapRef = eventTap
signal(SIGTERM, signalHandler)
signal(SIGINT, signalHandler)

let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
CGEvent.tapEnable(tap: eventTap, enable: true)
CFRunLoopRun()
