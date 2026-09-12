import { InMemoryFs } from 'just-bash/browser'

export const fs = new InMemoryFs({
  '/workspace/README.md':
    '# Bash in your browser\n\nTry ls, cat README.md, cd examples, and pwd.\n\nWrite files with echo hello > greeting.txt, then refresh the Explorer.\nFiles are shared with the editor and reset when this page reloads.\nThis is a just-bash simulation, not a native Linux environment.\n',
  '/workspace/examples/hello.sh': 'echo "Hello from LVCE Editor!"\n',
})
export const toPath = (uri: string): string => {
  const url = new URL(uri)
  if (url.protocol !== 'bash-demo:' || url.host) throw new Error('Unsupported workspace URI')
  return decodeURIComponent(url.pathname)
}
export const fileSystem = {
  id: 'bash-demo',
  isReadonly: () => false,
  mkdir: (uri: string) => fs.mkdir(toPath(uri), { recursive: true }),
  readFile: async (uri: string) => new Blob([await fs.readFile(toPath(uri))]),
  writeFile: (uri: string, content: string) => fs.writeFile(toPath(uri), content),
  readDirWithFileTypes: async (uri: string) => {
    const path = toPath(uri)
    const names = await fs.readdir(path)
    return Promise.all(names.map(async (name) => ({ name, type: (await fs.stat(`${path}/${name}`)).isDirectory ? 3 : 7 })))
  },
  remove: (uri: string) => fs.rm(toPath(uri), { recursive: true }),
  rename: (oldUri: string, newUri: string) => fs.mv(toPath(oldUri), toPath(newUri)),
}
