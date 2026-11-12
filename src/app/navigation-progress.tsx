/** A thin bar along the top of the window while a slow navigation is pending. */
export function NavigationProgress({ active }: { active: boolean }) {
  if (!active) return null
  return (
    // Decorative: `main` carries `aria-busy` for assistive technology.
    <div
      aria-hidden
      data-testid="navigation-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-600/20"
    >
      <div className="h-full w-2/5 animate-progress bg-brand-600 motion-reduce:animate-none" />
    </div>
  )
}
