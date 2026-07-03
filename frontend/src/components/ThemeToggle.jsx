import { Moon, Sun } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useApp()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`rounded-full p-2.5 transition-colors hover:bg-store-hover ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={20} className="text-[#fbbf24]" /> : <Moon size={20} className="text-store-muted" />}
    </button>
  )
}
