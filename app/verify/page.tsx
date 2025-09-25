// app/verify/page.tsx
import VerificationPage from '@/components/VerificationPage'
import Navigation from '@/components/Navigation'

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <div className="py-6 bg-gray-100">
        <VerificationPage />
      </div>
    </div>
  )
}
