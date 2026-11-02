import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { createRouter } from './app/router'
import './i18n'
import { usePreferences } from './stores/preferences'

export default function App() {
  const [router] = useState(createRouter)
  const theme = usePreferences((s) => s.theme)
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        theme={theme}
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </>
  )
}
