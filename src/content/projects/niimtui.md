---
name: "niimtui"
description: "Terminal-first label design and printing for Niimbot printers: design a label in a TUI, preview exactly what will print, and send it over Bluetooth."
tags: ["Go", "TUI", "Bluetooth LE"]
link: "https://github.com/davidsanchez222/niimtui"
startDate: "2026-08-21"
video: "/media/niimtui-demo.mp4"
demo:
  wasm: "/demos/niimtui/niimtui.wasm"
  cols: 140
  rows: 30
---

Only keystrokes were used to make the label above, though niimtui also has full mouse support.

The preview and the printer share one render path, so what you see is what prints. In Kitty, Ghostty or WezTerm the live preview renders inline as a terminal image; other terminals fall back to a Preview.app window.

```bash
brew install davidsanchez222/tap/niimtui
niimtui
```

## Try it

The real designer, compiled to WebAssembly and drawn by [ghostty-web](https://github.com/coder/ghostty-web) (Ghostty's terminal emulator, built for the browser). It runs entirely in your browser: printing, live image previews and saving are switched off. Try <kbd>t</kbd> to add text, <kbd>q</kbd> for a QR code, <kbd>i</kbd> to edit and the arrow keys to move.
