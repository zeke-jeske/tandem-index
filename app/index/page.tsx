// src/app/index/page.tsx
import IndexGenerator from '@/components/IndexGenerator';
import Navigation from '@/components/Navigation';

export default function IndexPage() {
  return (
    <>
      <Navigation />
      <IndexGenerator />
    </>
  );
}