import { useEffect } from 'react'
import { useBrand } from './brand'

export function usePageTitle(title: string | undefined): void {
  const brand = useBrand()
  useEffect(() => {
    document.title = title ? `${title} · ${brand.name}` : brand.name
  }, [title, brand.name])
}
