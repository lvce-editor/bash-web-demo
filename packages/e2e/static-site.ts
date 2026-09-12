import { expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { chromium } from 'playwright'

const pathPrefix = '/bash-web-demo'
const staticRoot = join(import.meta.dirname, '..', '..', '.tmp', 'static')
const contentTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

const getFilePath = (requestUrl: string): string | undefined => {
  const url = new URL(requestUrl, 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === pathPrefix || pathname === `${pathPrefix}/`) {
    pathname = '/index.html'
  } else if (pathname.startsWith(`${pathPrefix}/`)) {
    pathname = pathname.slice(pathPrefix.length)
  } else {
    return undefined
  }
  const relativePath = normalize(pathname).replace(/^[/\\]+/, '')
  const filePath = join(staticRoot, relativePath)
  if (!filePath.startsWith(`${staticRoot}${sep}`)) {
    return undefined
  }
  return filePath
}

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const filePath = getFilePath(request.url || '')
  if (!filePath) {
    response.writeHead(404)
    response.end('Not Found')
    return
  }
  try {
    const content = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    })
    response.end(content)
  } catch {
    response.writeHead(404)
    response.end('Not Found')
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response)
})

await new Promise<void>((resolve) => {
  server.listen(0, '127.0.0.1', resolve)
})

const address = server.address()
if (!address || typeof address === 'string') {
  throw new Error('Failed to start static test server')
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  page.setDefaultTimeout(15_000)
  const url = `http://127.0.0.1:${address.port}${pathPrefix}/`
  const terminal = page.locator('.xterm-helper-textarea')
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(String(error))
    console.error(error)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(message.text())
  })
  await page.goto(url)
  await expect(page.locator('.Main .EditorRow', { hasText: '# Bash in your browser' })).toBeVisible({ timeout: 60_000 })
  await expect(terminal).toBeVisible({ timeout: 30_000 })
  await terminal.pressSequentially('ls; cat README.md; cd examples')
  await terminal.press('Enter')
  await terminal.pressSequentially('pwd')
  await terminal.press('Enter')
  await expect(page.locator('.xterm-rows')).toContainText('/workspace/examples')
  await terminal.pressSequentially('cd ..')
  await terminal.press('Enter')
  await terminal.pressSequentially('echo acceptance > result.txt')
  await terminal.press('Enter')
  await terminal.pressSequentially('cat result.txt')
  await terminal.press('Enter')
  await expect(page.locator('.xterm-rows')).toContainText('acceptance')
  await page.getByRole('button', { name: 'Refresh Explorer' }).click()
  await page.getByRole('treeitem', { name: 'result.txt', exact: true }).dblclick()
  await expect(page.locator('.Main .EditorRow', { hasText: 'acceptance' })).toBeVisible()
  await page.screenshot({ path: '.tmp/static-demo.png' })
  await page.reload()
  await expect(page.locator('.Main .EditorRow', { hasText: '# Bash in your browser' })).toBeVisible()
  await expect(terminal).toBeVisible()
  await expect(page.getByRole('treeitem', { name: 'result.txt', exact: true })).toHaveCount(0)
  if (errors.length) throw new Error(errors.join('\n'))
} catch (error) {
  await page.screenshot({ path: '.tmp/failure.png' })
  await writeFile('.tmp/failure.txt', await page.locator('body').ariaSnapshot())
  throw error
} finally {
  await browser.close()
  server.close()
}
