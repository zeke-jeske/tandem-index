import VerificationPage from '@/components/VerificationPage';
import Navigation from '@/components/Navigation';
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+Pro:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap"></link>
        </Head>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="py-6 bg-gray-100">
          <VerificationPage />
        </div>
      </div>
    </>
  );
}