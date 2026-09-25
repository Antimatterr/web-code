# Concept

Design diagrams for this project. Each one is stored three ways:

- `.mmd` — the Mermaid source, which is the thing to edit
- `.svg` — vector render, good for zooming
- `.png` — bitmap render, good for pasting into slides or docs

| Diagram | Question it answers |
|---|---|
| [architecture-overview](architecture-overview.mmd) | What runs on which thread, and what talks to what? |
| [edit-to-preview-sequence](edit-to-preview-sequence.mmd) | What happens between a keystroke and the updated preview? |
| [module-resolution-flow](module-resolution-flow.mmd) | How does one import statement turn into one file? |
| [file-save-lifecycle](file-save-lifecycle.mmd) | When is a file dirty, and when does it reach the disk? |
| [multi-tab-writer-lock](multi-tab-writer-lock.mmd) | How do two open tabs avoid corrupting the same project? |
| [opfs-inmemory-layers](opfs-inmemory-layers.mmd) | Why is there a memory layer in front of storage at all? |
| [opfs-flows-sequence](opfs-flows-sequence.mmd) | The three storage flows: startup, live edit, background save. |

The first five are walked through in the main [README](../README.md). The last
two are earlier sketches from the design phase, kept because they explain the
sync-versus-async split well.

## Re-rendering after an edit

There is no render step wired into the build. The images were produced by
loading the Mermaid library in a headless browser and rendering each source.
Any Mermaid renderer will do, including the live editor at mermaid.live.
