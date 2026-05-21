import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'DTB — Down To Build',
  description: 'AI React component builder with Cline-style agent workflow, Supabase sync, and GitHub push.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        {children}
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  )
}
