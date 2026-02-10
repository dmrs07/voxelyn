# Menu to CLI Mapping

Desktop source of truth is the native Electron menubar. The in-editor header is toolbar-only (no duplicated `File/Edit/View/Window/Help`).

## Mapping

| Menu Item | CLI Command | CWD Rule |
| --- | --- | --- |
| File -> New Project... | `voxelyn create <name> <template> [flags]` | User-selected parent folder |
| File -> Run CLI Command... | `voxelyn <allowed command> [args]` | Provided by modal, fallback to open project |
| Project -> Generate Texture... | `voxelyn generate texture --prompt ... [flags]` | Open project root |
| Project -> Generate Scenario... | `voxelyn generate scenario --prompt ... [flags]` | Open project root |
| Project -> Generate Other... | `voxelyn generate <type> --prompt ... [flags]` | Open project root |
| Build -> Dev... | `voxelyn dev [flags]` | Open project root |
| Build -> Build... | `voxelyn build [flags]` | Open project root |
| Build -> Preview... | `voxelyn preview [flags]` | Open project root |
| Build -> Serve... | `voxelyn serve [flags]` | Open project root |
| Build -> Deploy... | `voxelyn deploy [--dir ... --channel ... --build] [flags]` | Open project root |
| Plugins -> Add Plugin... | `voxelyn plugin add <name> [flags]` | Open project root |
| Plugins -> Remove Plugin... | `voxelyn plugin remove <name> [flags]` | Open project root |
| Plugins -> List Plugins | `voxelyn plugin list [flags]` | Open project root |
| Help -> Voxelyn CLI Help | `voxelyn --help` | Open project root if available, otherwise process cwd |

## Runner Constraints

- CLI is executed only in Electron `main` via `spawn(process.execPath, [cliEntryPath, ...args])`.
- No shell interpolation is used.
- Primary command is allowlisted (`create|dev|build|preview|serve|deploy|generate|plugin|--help|--list|--version`).
- Streamed events to renderer: `cli:stdout`, `cli:stderr`, `cli:exit`, `cli:error`.
- Cancellation: `cli:cancel` by `runId`.
