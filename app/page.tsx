// src/app/page.tsx
import VerificationPage from '@/components/VerificationPage';
import Navigation from '@/components/Navigation';

export default function Home() {
  return (
    <>
      <Navigation />
      <VerificationPage />
    </>
  );
}