# LVCE Editor: Bash on the web

[Open the demo](https://lvce-editor.github.io/bash-web-demo/).

The editor and a `just-bash` shell run entirely in your browser. Try:

```sh
ls
cat README.md
cd examples
pwd
bash hello.sh
echo hello > greeting.txt
```

The terminal and editor share the same in-memory filesystem. Refresh the Explorer to see newly created files, then open and edit them. Shell commands read saved editor changes. Reloading the page resets the workspace.

This is a Bash simulation, not a Linux virtual machine: native programs, Node.js, and package installation are unavailable. Input supports typing, backspace, Enter, and clearing the current line with Ctrl+C; full terminal line editing and interrupting a running command are not implemented.

## Architecture

An isolated extension registers the `bash-demo` filesystem provider and an existing `workspaceTransport` contribution. LVCE transfers the terminal message port to the extension's `bashDemo.connect` command. The extension implements the terminal JSON-RPC protocol and runs commands with `just-bash/browser`. Each terminal keeps its own working directory and environment, while all terminals and the editor share the filesystem.

The static build uses the published LVCE server exporter, enables the demo startup command, and emits a site under `/bash-web-demo/`. No backend, WebSocket server, credentials, or cross-origin isolation headers are needed.

## Development

Use the Node version in `.nvmrc`.

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run e2e:headless
```

CI validates the shell and static browser demo on pull requests. Passing main builds deploy `.tmp/static` through GitHub Pages.
