import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'BoltClone - AI Component Builder',
  description: 'Build React components with AI - powered by Ollama or any LLM API',
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
