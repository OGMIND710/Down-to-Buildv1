import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'DTB — Down To Build',
  description: 'AI React component builder with Cline-style agent workflow, Supabase sync, and GitHub push.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
