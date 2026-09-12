import { cp, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { root } from './root.ts'

const sharedProcessPath = join(root, 'node_modules', '@lvce-editor', 'shared-process', 'index.js')
const sharedProcessUrl = pathToFileURL(sharedProcessPath).toString()
const sharedProcess = await import(sharedProcessUrl)

process.env.PATH_PREFIX = '/bash-web-demo'
const { commitHash } = await sharedProcess.exportStatic({
  extensionPath: 'packages/extension',
  onLoadCommands: [
    {
      args: [],
      command: 'bashDemo.open',
      name: 'Open Browser Bash',
    },
  ],
  root,
  testPath: 'packages/e2e',
})

const settingsPath = join(root, 'dist', commitHash, 'config', 'defaultSettings.json')
const settings = JSON.parse(await readFile(settingsPath, 'utf8'))
settings['application.useOnLoadJson'] = true
await writeFile(settingsPath, JSON.stringify(settings, null, 2))

const extensionId = 'builtin.bash-web-demo'
await cp(join(root, 'packages', 'extension', 'dist'), join(root, 'dist', commitHash, 'extensions', extensionId, 'dist'), {
  force: true,
  recursive: true,
})

const staticDirectory = join(root, '.tmp', 'static')
await rm(staticDirectory, { force: true, recursive: true })
await cp(join(root, 'dist'), staticDirectory, { recursive: true })
