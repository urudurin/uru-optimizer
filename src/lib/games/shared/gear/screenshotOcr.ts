// Reads the text of a gear screenshot in the browser with Tesseract.js (Apache-2.0), for "Add from screenshot" in the
// gear editor. The worker and the OCR engine come from node_modules, bundled by Vite; only the English language data
// (~4 MB, cached by the browser) is fetched from Tesseract's default CDN on first use. Screenshots never leave the
// browser.

import coreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'

type OcrWorker = { recognize: (image: Blob) => Promise<{ data: { text: string } }>, terminate: () => Promise<unknown> }

let worker: Promise<OcrWorker> | undefined

function getWorker(): Promise<OcrWorker> {
  worker ??= import('tesseract.js').then(({ createWorker }) => createWorker('eng', 1, { workerPath: workerUrl, corePath: coreUrl }) as Promise<OcrWorker>)
  // A failed start (offline on first use) can be retried
  worker.catch(() => (worker = undefined))
  return worker
}

// Where a game's details panel sits on a full-screen 16:9 screenshot, as fractions of its width and height. Reading the
// whole screen mixes the panel's lines with the inventory grid beside it, so such screenshots are cropped to the panel
export type ScreenPanel = { x: number, y: number, width: number, height: number }

function isFullScreen(width: number, height: number): boolean {
  const ratio = width / height
  return width >= 1280 && ratio > 1.7 && ratio < 1.8
}

// Game screenshots are light text on dark panels; Tesseract reads dark text on light best, and small text better
// larger. So the image (or its panel) is scaled up 2x when small, made grayscale and inverted when it's mostly dark.
async function prepare(image: Blob, panel?: ScreenPanel): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  const area = panel
    ? { x: bitmap.width * panel.x, y: bitmap.height * panel.y, width: bitmap.width * panel.width, height: bitmap.height * panel.height }
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
  const scale = area.width < 1200 ? 2 : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)
  const context = canvas.getContext('2d')
  if (!context) return image
  context.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  let light = 0
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = data[i + 1] = data[i + 2] = gray
    if (gray > 127) light++
  }
  if (light < data.length / 8) {
    for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255 - data[i]
  }
  context.putImageData(pixels, 0, 0)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? image), 'image/png'))
}

// The screenshot's text, one entry per non-empty line: only the game's panel when it's a full-screen screenshot
// (cropped true), the whole image otherwise or when wholeImage is set
export async function readScreenshotLines(image: Blob, panel?: ScreenPanel, wholeImage = false): Promise<{ lines: string[], cropped: boolean }> {
  const ocr = await getWorker()
  let crop: ScreenPanel | undefined
  if (panel && !wholeImage) {
    const bitmap = await createImageBitmap(image)
    if (isFullScreen(bitmap.width, bitmap.height)) crop = panel
  }
  const { data } = await ocr.recognize(await prepare(image, crop))
  return { lines: data.text.split('\n').map((line) => line.trim()).filter(Boolean), cropped: !!crop }
}
