import { Bash } from 'just-bash/browser'
import { fs, toPath } from './FileSystem.ts'

export const createSession = (output: (text: string) => void, cwd = '/workspace') => {
  const bash = new Bash({ fs, cwd })
  let directory = cwd
  let env: Record<string, string> = {}
  let line = ''
  let disposed = false
  let queue = Promise.resolve()
  const prompt = () => output(`${directory} $ `)
  prompt()
  return {
    dispose: () => {
      disposed = true
    },
    write: (data: string) => {
      queue = queue.then(async () => {
        for (const character of data) {
          if (disposed) return
          if (character === '\r' || character === '\n') {
            output('\r\n')
            const command = line
            line = ''
            try {
              const result = await bash.exec(command, { cwd: directory, env })
              directory = result.env.PWD || directory
              env = result.env
              if (disposed) return
              output((result.stdout + result.stderr).replace(/\r?\n/g, '\r\n'))
            } catch (error) {
              if (disposed) return
              output(`${String(error)}\r\n`)
            }
            prompt()
          } else if (character === '\u007f' || character === '\b') {
            if (line) {
              line = line.slice(0, -1)
              output('\b \b')
            }
          } else if (character === '\u0003') {
            line = ''
            output('^C\r\n')
            prompt()
          } else if (character >= ' ' && character !== '\u007f') {
            line += character
            output(character)
          }
        }
      })
      return queue
    },
  }
}

const connections = new Set<() => void>()
export const connect = async (uri: string, type: string, port: MessagePort): Promise<void> => {
  if (type !== 'terminal-process') {
    port.close()
    throw new Error(`Unsupported process: ${type}`)
  }
  toPath(uri)
  const sessions = new Map<number, ReturnType<typeof createSession>>()
  const close = () => {
    for (const session of sessions.values()) session.dispose()
    sessions.clear()
    port.onmessage = null
    port.onmessageerror = null
    port.removeEventListener('close', close)
    port.close()
    connections.delete(close)
  }
  connections.add(close)
  port.onmessageerror = close
  port.addEventListener('close', close)
  port.onmessage = async ({ data }) => {
    const { id, method, params = [] } = data
    try {
      const [terminalId, value] = params
      switch (method) {
        case 'Terminal.create': {
          sessions.get(terminalId)?.dispose()
          const session = createSession(
            (text) => port.postMessage({ jsonrpc: '2.0', method: 'Viewlet.send', params: [terminalId, 'handleData', text] }),
            toPath(value || uri),
          )
          sessions.set(terminalId, session)
          break
        }
        case 'Terminal.write': {
          const session = sessions.get(terminalId)
          if (!session) throw new Error('Terminal is closed')
          await session.write(value)
          break
        }
        case 'Terminal.resize':
          break
        case 'Terminal.dispose':
          sessions.get(terminalId)?.dispose()
          sessions.delete(terminalId)
          break
        default:
          throw new Error(`Unsupported terminal method: ${method}`)
      }
      if (id !== undefined) port.postMessage({ jsonrpc: '2.0', id, result: null })
    } catch (error) {
      if (id !== undefined) port.postMessage({ jsonrpc: '2.0', id, error: { code: -32000, message: String(error) } })
    }
  }
  port.start()
}
export const dispose = () => {
  for (const close of connections) close()
}
