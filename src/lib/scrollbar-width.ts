/**
 * Publishes the width a scroll region reserves for its scrollbar on each edge
 * (`scrollbar-gutter: stable`; 0 with overlay scrollbars) as the CSS variable
 * `--sbw` on <html>. Scroll regions reserve that width on both edges, and the
 * bands above them pad by it, so the header, a page's fixed top and its list
 * keep the same edges whether or not a scrollbar shows (`--page-gutter` in
 * src/index.css). It is measured the way the regions reserve it, not from a
 * scrollbar drawn by `overflow: scroll`, which some browsers hide while still
 * reserving the gutter. Measured again on resize, because a browser zoom
 * changes the width in CSS pixels.
 *
 * Returns a function that stops following resizes.
 */
export function trackScrollbarWidth(): () => void {
  const probe = document.createElement('div')
  const inside = document.createElement('div')
  Object.assign(probe.style, {
    position: 'absolute',
    top: '-9999px',
    width: '100px',
    height: '10px',
    overflowY: 'auto',
    visibility: 'hidden',
  })
  probe.style.setProperty('scrollbar-gutter', 'stable')
  probe.append(inside)
  let last = ''
  const measure = () => {
    document.body.append(probe)
    const width = `${Math.max(0, Math.round(100 - inside.getBoundingClientRect().width))}px`
    probe.remove()
    if (width !== last) document.documentElement.style.setProperty('--sbw', (last = width))
  }
  measure()
  window.addEventListener('resize', measure)
  return () => window.removeEventListener('resize', measure)
}
