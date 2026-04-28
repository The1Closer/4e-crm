# PRD: Fix Field Drag, Resize, and Tap-to-Edit in Contract Signer

## Scope

**One file only:** `src/app/contracts/editor/ContractsEditorCore.tsx`

Fix three broken field interactions. Change nothing else — no refactoring, no new features, no style changes outside what is explicitly described below.

---

## Bug 1: Drag is broken (element jitters/snaps back)

### Root cause

The `Rnd` component is in controlled mode — it receives `position` as a prop. The current `onDrag` callback calls `updateAnnotation` on every drag event, which updates React state, which triggers a re-render, which passes a new `position` prop to `Rnd` mid-drag. This fights react-rnd's internal drag tracking and causes the element to snap or jitter.

### Fix

**Delete the `onDrag` handler entirely.** Do not replace it with anything.

`onDragStop` already handles the final position commit. react-rnd tracks position visually during drag using its own internal state — the React state only needs to sync once on stop.

Before:
```tsx
onDrag={(_, position) =>
  updateAnnotation(annotation.id, {
    x: position.x,
    y: position.y,
  })
}
onDragStop={(_, position) => {
  updateAnnotation(annotation.id, {
    x: position.x,
    y: position.y,
  })
  annotationGestureRef.current.dragging = false
  window.setTimeout(() => {
    annotationTapSuppressedRef.current = false
  }, 120)
}}
```

After:
```tsx
onDragStop={(_, position) => {
  updateAnnotation(annotation.id, {
    x: position.x,
    y: position.y,
  })
  annotationGestureRef.current.dragging = false
  window.setTimeout(() => {
    annotationTapSuppressedRef.current = false
  }, 120)
}}
```

No other drag-related code changes.

---

## Bug 2: Resize handles are invisible and untouchable

### Root cause

The PDF page container div has the class `overflow-hidden` (it's the `relative overflow-hidden rounded-[1.4rem]` div that wraps `<Page>` and all the `Rnd` annotations). The `resizeHandleStyles` use negative offsets (`right: -5, bottom: -5`, etc.), which place the handles 5px outside the container boundary. `overflow: hidden` clips everything outside that boundary, so the handles are visually cut off and cannot be tapped.

### Fix

Change the `resizeHandleStyles` on every `Rnd` component so all offsets are `0` instead of `-5`. The handles stay inside the boundary where they are visible and touchable.

Before:
```tsx
resizeHandleStyles={{
  bottomRight: { width: 22, height: 22, right: -5, bottom: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
  bottomLeft: { width: 22, height: 22, left: -5, bottom: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
  topRight: { width: 22, height: 22, right: -5, top: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
  topLeft: { width: 22, height: 22, left: -5, top: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
}}
```

After:
```tsx
resizeHandleStyles={{
  bottomRight: { width: 22, height: 22, right: 0, bottom: 0, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
  bottomLeft: { width: 22, height: 22, left: 0, bottom: 0, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
  topRight: { width: 22, height: 22, right: 0, top: 0, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
  topLeft: { width: 22, height: 22, left: 0, top: 0, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
}}
```

No other resize-related code changes.

---

## Bug 3: Tap-to-edit uses `window.prompt()` — broken on iPad

### Root cause

`handleAnnotationTap` calls `window.prompt()` for `text`, `date`, and `initials` fields. On iPad Safari, `window.prompt()` is a native OS dialog that cannot be styled, can be blocked, and feels completely out of place in the app.

### Fix

Replace `window.prompt()` with an in-app bottom sheet that slides up from the bottom of the screen when a `text`, `date`, or `initials` annotation is tapped.

**Step 1 — Add state for the edit bar:**

Add one new piece of state near the other `useState` declarations:

```ts
const [editBarAnnotationId, setEditBarAnnotationId] = useState<string | null>(null)
```

**Step 2 — Update `handleAnnotationTap`:**

Replace the `window.prompt()` block with a state setter that opens the bottom bar. The function should become:

```ts
function handleAnnotationTap(annotation: Annotation) {
  setSelectedId(annotation.id)

  if (annotation.type === 'signature-box') {
    openSignaturePad(annotation.page)
    return
  }

  if (
    annotation.type === 'text' ||
    annotation.type === 'date' ||
    annotation.type === 'initials'
  ) {
    setEditBarAnnotationId(annotation.id)
  }
}
```

**Step 3 — Derive the annotation being edited:**

Add a memo near the other memos:

```ts
const editBarAnnotation = useMemo(
  () => (editBarAnnotationId ? annotations.find((a) => a.id === editBarAnnotationId) ?? null : null),
  [annotations, editBarAnnotationId]
)
```

**Step 4 — Add the bottom edit bar to the JSX:**

Add this block just before the closing `</div>` of the main return (before the sticky save button block). It should render only when `editBarAnnotation` is set and `signatureOpen` is false:

```tsx
{editBarAnnotation && !signatureOpen ? (
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-4 py-4 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]">
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        Edit {getAnnotationTypeLabel(editBarAnnotation.type)} field
      </div>
      <input
        value={editBarAnnotation.value ?? ''}
        onChange={(event) =>
          updateAnnotation(editBarAnnotation.id, { value: event.target.value })
        }
        className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none transition focus:border-[#9c7a4a]"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            updateAnnotation(editBarAnnotation.id, {
              fontSize: Math.max(10, (editBarAnnotation.fontSize ?? 18) - 2),
            })
          }
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
        >
          A−
        </button>
        <span className="min-w-[3ch] text-center text-sm text-gray-600">
          {editBarAnnotation.fontSize ?? 18}
        </span>
        <button
          type="button"
          onClick={() =>
            updateAnnotation(editBarAnnotation.id, {
              fontSize: Math.min(72, (editBarAnnotation.fontSize ?? 18) + 2),
            })
          }
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
        >
          A+
        </button>
        <button
          type="button"
          onClick={() => {
            deleteSelected()
            setEditBarAnnotationId(null)
          }}
          className="ml-auto rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => setEditBarAnnotationId(null)}
          className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Done
        </button>
      </div>
    </div>
  </div>
) : null}
```

**Step 5 — Close the edit bar when selection changes:**

In the existing `onMouseDown` and `onTouchStart` handlers on the `Rnd` component, add `setEditBarAnnotationId(null)` so tapping a different annotation closes the bar:

```tsx
onMouseDown={(event) => {
  event.stopPropagation()
  setSelectedId(annotation.id)
  setEditBarAnnotationId(null)  // add this line
}}
onTouchStart={(event: ReactTouchEvent) => {
  event.stopPropagation()
  setSelectedId(annotation.id)
  setEditBarAnnotationId(null)  // add this line
}}
```

Also add `setEditBarAnnotationId(null)` to the `onClick` handler on the page container div (the deselect click):

```tsx
onClick={(event) => {
  if (activeInsertionType) {
    placeAnnotationFromPointer(pageNumber, activeInsertionType, event)
  } else {
    setSelectedId(null)
    setEditBarAnnotationId(null)  // add this line
  }
}}
```

---

## What Must NOT Change

- The signature modal and all signature-related logic
- The `onDragStart`, `onDragStop`, `onResizeStart`, `onResizeStop` handlers (except the `onDrag` deletion in Bug 1)
- The `annotationGestureRef` and `annotationTapSuppressedRef` logic
- The `handleAnnotationTap` function's `signature-box` branch (keep `openSignaturePad`)
- The sticky save button
- All other state, functions, layout, styling, and components
- Any file other than `ContractsEditorCore.tsx`
