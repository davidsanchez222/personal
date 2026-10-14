---
name: "niimtui"
description: "Terminal-first label design and printing for Niimbot printers: design a label in a TUI, preview exactly what will print, and send it over Bluetooth."
tags: ["Go", "TUI", "Bluetooth LE"]
link: "https://github.com/davidsanchez222/niimtui"
startDate: "2026-08-21"
preview:
  cast: "/casts/niimtui.cast"
  cols: 140
  rows: 30
---

The recording above uses only the keyboard: add a text field and a QR code, move and resize them, then toggle the grid and invert views. niimtui also has full mouse support.

The preview and the printer share one render path, so what you see is what prints. In Kitty, Ghostty or WezTerm the live preview renders inline as a terminal image; other terminals fall back to a Preview.app window.

```bash
brew install davidsanchez222/tap/niimtui
niimtui
```
