import VerificationPage from '@/components/VerificationPage';
import Navigation from '@/components/Navigation';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-6">
        <VerificationPage />
      </div>
    </div>
  );
}