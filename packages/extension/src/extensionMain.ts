import { activate, registerCommand, registerFileSystemProvider, executeCommand, showNotification } from '@lvce-editor/api'
import { fileSystem } from './FileSystem.ts'
import { connect, dispose } from './Terminal.ts'

await activate()
registerFileSystemProvider(fileSystem)
registerCommand({ id: 'bashDemo.connect', execute: connect })
registerCommand({
  id: 'bashDemo.request',
  execute: (_uri: string, type: string) => {
    if (type === 'terminal-options') return { command: 'bash', args: [] }
    throw new Error(`Unsupported workspace request: ${type}`)
  },
})
registerCommand({
  id: 'bashDemo.open',
  execute: () => {
    setTimeout(() => {
      void (async () => {
        await executeCommand('Workspace.setUri', 'bash-demo:///workspace')
        await executeCommand('Layout.showMain')
        await executeCommand('Layout.showPanel', 'Terminals', 'bash-demo:///workspace')
        await executeCommand('Main.openUri', 'bash-demo:///workspace/README.md')
      })().catch((error) => showNotification('error', String(error)))
    }, 0)
  },
})
export const deactivate = dispose
