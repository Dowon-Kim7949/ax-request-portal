import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { createRouter } from './app/router'
import './i18n'

export default function App() {
  const [router] = useState(createRouter)
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </>
  )
}
