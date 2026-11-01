# Design System Architecture — Bharat Dev Tools

## Visual Identity & Design Philosophy
**Aesthetic Style**: High-Performance Developer Studio (inspired by Linear, Raycast, and Vercel)
**Core Promise**: 100% Client-Side Privacy, Instantaneous Feedback, Zero Clutter.

---

## 1. Color Palette & Semantic Tokens

### Dark Mode (Primary Developer Experience)
| Token | HEX | HSL | Semantic Usage |
|---|---|---|---|
| `--background` | `#090E17` | `222 47% 7%` | Base application background |
| `--card` | `#0F172A` | `222 47% 10%` | Card surfaces, editor containers |
| `--muted` | `#1A2333` | `217 33% 15%` | Secondary panels, inputs, inactive tabs |
| `--border` | `#1E293B` | `217 33% 18%` | Subtle structural dividers |
| `--foreground` | `#F8FAFC` | `210 40% 98%` | Primary high-contrast text |
| `--muted-foreground` | `#94A3B8` | `215 20% 65%` | Labels, captions, hints |
| `--primary` | `#3B82F6` | `217 91% 60%` | Interactive accents, active focus, primary CTAs |
| `--color-accent` | `#10B981` | `158 64% 48%` | Run / Success / Valid indicators |
| `--destructive` | `#EF4444` | `0 62.8% 60.6%` | Validation errors, delete / clear |

### Light Mode
| Token | HEX | Semantic Usage |
|---|---|---|
| `--background` | `#F8FAFC` | Soft off-white base |
| `--card` | `#FFFFFF` | Crisp white cards |
| `--muted` | `#F1F5F9` | Slate 100 toolbars & inactive elements |
| `--border` | `#E2E8F0` | Slate 200 borders |
| `--foreground` | `#0F172A` | Deep charcoal primary typography |
| `--primary` | `#2563EB` | High-contrast blue accent |

---

## 2. Typography
- **UI / Headings / Navigation**: `Geist Sans` / `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
- **Code / JSON / cURL / RegEx**: `Geist Mono` / `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`
- **Scale**:
  - Tool Title: `text-xl sm:text-2xl font-bold tracking-tight`
  - Section Headers: `text-xs font-semibold uppercase tracking-wider font-mono`
  - Body & Form labels: `text-xs sm:text-sm`
  - Code blocks: `text-xs sm:text-sm font-mono leading-relaxed`

---

## 3. Reusable UI Components
All tools share standard components located in `src/components/`:
1. `ToolLayout`: Standardized breadcrumb, tool icon in themed container, title, client-side badge, share button, and related tools row.
2. `CommandPalette`: Keyboard-driven tool search (`⌘K` / `Ctrl+K`) across all 20 tools.
3. `ToolIcon`: Unified Lucide SVG icons mapped to each tool (replaces emojis).
4. `SegmentedTabs`: Contained, elevated tab switchers for tool modes.
5. `CodeEditor`: Editor pane with filename, language badge, line & byte metrics, "Sample", "Paste", "Upload", and "Clear".
6. `OutputPane`: Output view with language badge, line counter, status badge ("Formatted", "Valid"), "Download", and `CopyButton`.
7. `CopyButton`: Clipboard copy with feedback checkmark and accessible aria attributes.
8. `ErrorMessage`: Dismissible alert with AlertCircle icon and line/column breakdown.

