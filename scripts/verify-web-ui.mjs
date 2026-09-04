import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const appUrl = process.env.APP_URL || 'http://127.0.0.1:3091'
const debugUrl = process.env.CDP_URL || 'http://127.0.0.1:9223'
const screenshotDir = process.env.SCREENSHOT_DIR ? resolve(process.env.SCREENSHOT_DIR) : undefined

async function waitForValue(read, label, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const value = await read()
      if (value) return value
    } catch {}
    await new Promise(resolvePromise => setTimeout(resolvePromise, 150))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const targets = await waitForValue(
  async () => {
    const response = await fetch(`${debugUrl}/json/list`)
    if (!response.ok) return undefined
    const pages = await response.json()
    return pages.find(item => item.type === 'page') ? pages : undefined
  },
  'Chrome DevTools target',
)
const page = targets.find(item => item.type === 'page')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolvePromise, reject) => {
  socket.addEventListener('open', resolvePromise, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let id = 0
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  const waiter = pending.get(message.id)
  if (message.error) process.stderr.write(`[cdp] id=${message.id} ERROR ${JSON.stringify(message.error)}\n`)
  if (!waiter) return
  pending.delete(message.id)
  message.error ? waiter.reject(new Error(`${waiter.method} failed: ${message.error.message}`)) : waiter.resolve(message.result)
})
const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
  const requestId = ++id
  pending.set(requestId, { method, resolve: resolvePromise, reject })
  socket.send(JSON.stringify({ id: requestId, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: appUrl })
await waitForValue(() => evaluate(`document.readyState === 'complete'`), 'page load')
await waitForValue(() => evaluate(`Boolean(document.querySelector('[data-token-usage-board].us-nav'))`), 'sidebar entry')
await evaluate(`document.querySelector('[data-token-usage-board].us-nav').click()`)
await waitForValue(() => evaluate(`document.querySelectorAll('.us-stats-strip .us-stat-cell').length === 5`), 'dashboard')
await waitForValue(() => evaluate(`document.querySelectorAll('.us-heat .us-cell').length === 371`), 'activity heatmap')
await new Promise(resolvePromise => setTimeout(resolvePromise, 255))
// Dismiss the built-in DSH welcome/onboarding dialogs (locale-independent).
for (let attempt = 0; attempt < 5; attempt += 1) {
  const result = await evaluate(`(() => {
    const wanted = new Set(['继续', 'Continue', '知道了', 'Got it', '关闭', 'Close', '稍后配置', 'Configure later'])
    const dialogs = [...document.querySelectorAll('div[role="presentation"]')]
      .filter(dialog => dialog.querySelector('[class*="_mask_"]') || dialog.querySelector('[role="dialog"]'))
    if (dialogs.length === 0) return 'none'
    for (const dialog of dialogs) {
      const button = [...dialog.querySelectorAll('button')].find(node => wanted.has(node.textContent?.trim()))
      if (button) { button.click(); return 'clicked' }
    }
    for (const dialog of dialogs) {
      if (/Internal Testing|Add an API key|内测声明|API 密钥/i.test(dialog.textContent ?? '')) dialog.remove()
    }
    return 'removed'
  })()`)
  await new Promise(resolvePromise => setTimeout(resolvePromise, 350))
  if (result !== 'clicked') break
}

const report = await evaluate(`(() => {
  const shell = document.querySelector('.us-shell')
  return {
    statCells: document.querySelectorAll('.us-stats-strip .us-stat-cell').length,
    heatCells: document.querySelectorAll('.us-heat .us-cell').length,
    monthLabels: document.querySelectorAll('.us-heat-months span').length,
    modeButtons: document.querySelectorAll('.us-segment button').length,
    insightsRows: document.querySelectorAll('.us-duo-row').length,
    skillRows: document.querySelectorAll('.us-skill-row').length,
    pieRows: document.querySelectorAll('.us-pie-row').length,
    fontFamily: getComputedStyle(shell).fontFamily,
  }
})()`)

if (
  report.statCells !== 5 || report.heatCells !== 371 || report.monthLabels !== 53 ||
  report.modeButtons !== 4 || report.insightsRows !== 5 ||
  report.skillRows < 1 || report.pieRows < 1
) {
  throw new Error(`UI contract failed: ${JSON.stringify(report)}`)
}

if (screenshotDir) {
  await mkdir(screenshotDir, { recursive: true })
  const capture = async (filename, captureBeyondViewport = true) => {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport, fromSurface: true })
    const buffer = Buffer.from(result.data, 'base64')
    if (filename) await writeFile(resolve(screenshotDir, filename), buffer)
    return buffer
  }
  await evaluate(`document.body.removeAttribute('data-ds-dark-theme'); document.querySelector('.us-scroll').scrollTop = 0`)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 600, deviceScaleFactor: 1.5, mobile: false })
  await new Promise(resolvePromise => setTimeout(resolvePromise, 900))
  const fullHeight = await evaluate(`Math.ceil(document.querySelector('.us-top').offsetHeight + document.querySelector('.us-content').offsetHeight + 50)`)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: fullHeight, deviceScaleFactor: 1.5, mobile: false })
  await new Promise(resolvePromise => setTimeout(resolvePromise, 350))
await capture('dashboard-light-full.png')
  await evaluate(`document.body.setAttribute('data-ds-dark-theme', '')`)
  await new Promise(resolvePromise => setTimeout(resolvePromise, 250))
await capture('dashboard-dark-full.png')

  await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false })
  await evaluate(`document.body.removeAttribute('data-ds-dark-theme'); document.querySelector('.us-scroll').scrollTop = 0`)
  await new Promise(resolvePromise => setTimeout(resolvePromise, 450))
  await evaluate(`(() => {
    const pointer = document.createElement('div')
    pointer.id = 'us-demo-pointer'
    pointer.innerHTML = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M3 2.5v19l5.1-4.8 3.7 8.3 3.3-1.5-3.7-8.1 7-.2z" fill="white" stroke="#18202a" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    pointer.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:26px;z-index:9999;pointer-events:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.22));transform:translate(-40px,-40px)'
    document.body.append(pointer)
  })()`)
  const frames = []
  const delays = []
  const addFrame = async delay => { frames.push(await capture(undefined, false)); delays.push(delay) }
  let pointerX = 900
  let pointerY = 70
  const hidePointer = async () => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
    await evaluate(`document.querySelector('#us-demo-pointer').style.transform = 'translate(-40px,-40px)'`)
  }
  const hover = async selector => {
    const point = await evaluate(`(() => {
      const target = document.querySelector(${JSON.stringify(selector)})
      if (!target) return null
      const rect = target.getBoundingClientRect()
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
    })()`)
    if (!point) throw new Error(`Unable to hover ${selector}`)
    const startX = pointerX
    const startY = pointerY
    for (let step = 1; step <= 4; step += 1) {
      pointerX = Math.round(startX + (point.x - startX) * step / 4)
      pointerY = Math.round(startY + (point.y - startY) * step / 4)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pointerX, y: pointerY })
      await evaluate(`document.querySelector('#us-demo-pointer').style.transform = 'translate(${pointerX}px,${pointerY}px)'`)
      await new Promise(resolvePromise => setTimeout(resolvePromise, 65))
      await addFrame(80)
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 160))
  }
  const scrollTo = async (target, steps) => {
    await hidePointer()
    const start = await evaluate(`document.querySelector('.us-scroll').scrollTop`)
    for (let step = 1; step <= steps; step += 1) {
      const eased = 1 - Math.pow(1 - step / steps, 3)
      const next = Math.round(start + (target - start) * eased)
      await evaluate(`document.querySelector('.us-scroll').scrollTop = ${next}`)
      await new Promise(resolvePromise => setTimeout(resolvePromise, 70))
      await addFrame(90)
    }
  }
  const clickMode = async (...labels) => {
    const clicked = await evaluate(`(() => {
      const candidates = ${JSON.stringify(labels)}
      for (const button of document.querySelectorAll('.us-segment button')) {
        if (candidates.includes(button.textContent.trim())) { button.click(); return button.textContent.trim() }
      }
      return null
    })()`)
    if (!clicked) throw new Error(`Unable to find mode button: ${labels.join(' / ')}`)
    await new Promise(resolvePromise => setTimeout(resolvePromise, 350))
  }
await addFrame(900)
  const heatTop = await evaluate(`Math.max(0, document.querySelector('.us-heat').closest('.us-panel').offsetTop - 18)`)
  await scrollTo(heatTop, 3)
await hover('.us-cell-tip[data-level="5"]')
  await addFrame(950)
await clickMode('每周', 'Weekly')
  await addFrame(700)
await hover('.us-bar')
  await addFrame(1050)
await clickMode('累计', 'Cumulative')
  await addFrame(900)
await clickMode('每日', 'Daily')
  await addFrame(500)
  const duoTop = await evaluate(`Math.max(0, document.querySelector('.us-duo').offsetTop - 18)`)
  await scrollTo(duoTop, 6)
await hover('.us-skill-row')
  await addFrame(850)
  await scrollTo(0, 8)
  await addFrame(1100)
await sharp(frames, { join: { animated: true } }).gif({ loop: 0, delay: delays, colours: 128, dither: 0.7, effort: 8 }).toFile(resolve(screenshotDir, 'usage-demo.gif'))
}

console.log(JSON.stringify(report, null, 2))
socket.close()