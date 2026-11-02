import { useEffect } from 'react'
import { appConfig } from '@/config/app.config'

export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${appConfig.brand.name}` : appConfig.brand.name
  }, [title])
}
