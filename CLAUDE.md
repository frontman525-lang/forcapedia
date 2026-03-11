# Forcapedia — Claude Code Guidelines

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · Razorpay / PayPal

---

## MOBILE RESPONSIVENESS — READ BEFORE TOUCHING ANY FILE

### The Core Rule: Never use `100vh`
Mobile browsers (iOS Safari, Android Chrome) change the viewport height constantly —
when the address bar shows/hides, when the keyboard opens, when the bottom nav appears.
`100vh` is calculated against the **largest possible** viewport and never updates,
causing visible layout jumps, stuck scroll, and "background moving" artifacts.

**Always use CSS variables defined in `globals.css`:**

```css
min-height: var(--app-h)   /* full-screen page shells  — maps to 100dvh */
height: var(--app-sh)      /* bottom sheets / drawers  — maps to 100svh (never shrinks with keyboard) */
```

In React inline styles:
```tsx
style={{ minHeight: 'var(--app-h)' }}         // page shell
style={{ height: 'calc(var(--app-sh) * 0.78)' }}  // bottom sheet at 78% height
```

`100dvh` = dynamic — updates as chrome shows/hides (no jump on initial load).
`100svh` = small — always the SMALLEST size, never changes when keyboard opens.
Supported in all modern browsers: Chrome 108+, Safari 15.4+, Firefox 101+.

### Fixed Background Layers
Any `position: fixed` background (canvas, noise overlay, HomeBackground) MUST have:
```css
transform: translateZ(0);
-webkit-transform: translateZ(0);
will-change: transform;
```
This promotes it to a GPU compositor layer so it never repaints during scroll.

### Canvas Resize Handler
When a virtual keyboard opens on mobile, `window.innerHeight` shrinks — this fires
a `resize` event. Canvas rebuild on every resize = visible background spike.

**Only rebuild canvas when width changes OR the new height is LARGER:**
```ts
const resize = () => {
  const newW = window.innerWidth
  const newH = window.innerHeight
  if (newW !== canvas.width || newH > canvas.height) {
    canvas.width  = newW
    canvas.height = newH
  }
}
```

### Safe-Area Insets (iPhone notch / Android navigation bar)
Bottom-fixed elements must account for the device's safe area:
```tsx
style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
```

### Touch & Scroll
- Use `touch-action: pan-x pan-y` on scrollable content to allow both scroll and text selection
- `overscroll-behavior: none` is set globally — do not override it per-page
- `smooth-scroll` is set globally — do not add it per-component

### Mobile Layout Patterns
- **Two equal tiles side by side:** use `clamp(130px, 42vw, 168px)` for each tile + `flexWrap: 'nowrap'`
- **Bottom action bar height:** `var(--bottom-bar-h)` (54px) — use this in offset calculations
- **Selection toolbars:** account for the bottom bar when computing `below` space:
  ```ts
  const reservedBottom = window.innerWidth < 768 ? 54 : 0
  const below = window.innerHeight - lastRect.bottom - reservedBottom
  ```
- **isMobile detection:** `window.innerWidth < 768` in a resize listener — this is width-based,
  so it does NOT fire when the keyboard opens (which only changes height). This is intentional.

### After Adding or Changing Any Page / Component — Checklist
1. Did you use `100vh` anywhere? → Replace with `var(--app-h)` or `var(--app-sh)`
2. Did you use `78vh`, `80vh`, etc. for a sheet/drawer? → Use `calc(var(--app-sh) * 0.78)`
3. Is there a `position: fixed` background layer? → Add `transform: translateZ(0)`
4. Is there a canvas with a resize handler? → Use the height-guard pattern above
5. Is there a bottom-fixed bar? → Add `env(safe-area-inset-bottom, 0px)` padding
6. Are two tiles/cards side by side? → Use `clamp()` width + `flexWrap: 'nowrap'`
7. Does anything appear near the bottom of the screen? → Test with keyboard open on mobile

---

## Payment Architecture
- Provider-agnostic: `lib/payments/` — add new providers here, never in API routes
- Razorpay fires `subscription.cancelled` immediately on cancel-at-period-end — the processor
  checks `cancel_at_period_end + current_period_end > now()` before downgrading tier
- `user_usage.tier` can lag behind real access — always prefer `subscriptions.status + cancel_at_period_end + current_period_end` as the authoritative source

## Key Files
- `app/globals.css` — design tokens, viewport CSS vars, base styles
- `components/ParticleCanvas.tsx` — star canvas with mobile-safe resize handler
- `components/HomeBackground.tsx` — CSS-only starfield + Mars, GPU composited
- `components/StudyLobby.tsx` — `var(--app-h)`, tiles use `clamp()` width
- `components/StudyRoom.tsx` — mobile bottom bar, chat drawer uses `var(--app-sh)`
- `components/ExplainPanel.tsx` — bottom sheet uses `calc(var(--app-sh) * 0.78)`
- `lib/payments/processor.ts` — single webhook→DB handler for all payment providers
