import Navigation from './Navigation'

/** Used by all main pages except the landing page. */
export default function NavLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <div className="py-6 bg-gray-100">{children}</div>
    </div>
  )
}
