import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSession, connect, dispose } from '../src/Terminal.ts'
import { fileSystem } from '../src/FileSystem.ts'

test('shell keeps cwd and shares reads and writes with the editor provider', async () => {
  let output = ''
  const shell = createSession((text) => {
    output += text
  })
  await shell.write('ls\rcat README.md\rcd examples\rpwd\r')
  assert.match(output, /hello.sh|examples/)
  assert.match(output, /Bash in your browser/)
  assert.match(output, /\/workspace\/examples\r\n/)
  await shell.write('echo terminal > shared.txt\r')
  assert.equal(await (await fileSystem.readFile('bash-demo:///workspace/examples/shared.txt')).text(), 'terminal\n')
  await fileSystem.writeFile('bash-demo:///workspace/examples/shared.txt', 'editor\n')
  await shell.write('cat shared.txt\r')
  assert.match(output, /editor\r\n/)
  shell.dispose()
})

test('queued input and backspace preserve command order', async () => {
  let output = ''
  const shell = createSession((text) => {
    output += text
  })
  const first = shell.write('cd examples\r')
  const second = shell.write('echo oops\u007f\u007f\u007f\u007fhello > queued.txt\r')
  await Promise.all([first, second])
  assert.equal(await (await fileSystem.readFile('bash-demo:///workspace/examples/queued.txt')).text(), 'hello\n')
  shell.dispose()
  const previous = output
  await shell.write('echo after dispose\r')
  assert.equal(output, previous)
})

test('terminal message port responds to creation and closes cleanly', async () => {
  const { port1, port2 } = new MessageChannel()
  try {
    await connect('bash-demo:///workspace', 'terminal-process', port1)
    const response = new Promise((resolve) => {
      port2.onmessage = ({ data }) => {
        if (data.id === 1) resolve(data)
      }
    })
    port2.postMessage({ jsonrpc: '2.0', id: 1, method: 'Terminal.create', params: [42, 'bash-demo:///workspace', 'bash', []] })
    assert.deepEqual(await response, { jsonrpc: '2.0', id: 1, result: null })
  } finally {
    dispose()
    port2.close()
  }
})

test('browser compression adapter round trips and enforces output limit', async () => {
  const { gzipSync, gunzipSync } = await import('../src/Zlib.ts')
  const input = new TextEncoder().encode('hello browser '.repeat(100))
  const compressed = gzipSync(input, { level: -1 })
  assert.deepEqual(gunzipSync(compressed), input)
  assert.throws(() => gunzipSync(compressed, { maxOutputLength: 10 }), /limit exceeded/)
})

test('filesystem provider reports LVCE directory and file types', async () => {
  const entries = await fileSystem.readDirWithFileTypes('bash-demo:///workspace')
  assert.equal(entries.find((entry) => entry.name === 'examples')?.type, 3)
  assert.equal(entries.find((entry) => entry.name === 'README.md')?.type, 7)
})
