import IndexGenerator from '@/components/IndexGenerator';
import Navigation from '@/components/Navigation';

export default function IndexPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <div className="py-6 bg-gray-100">
        <IndexGenerator />
      </div>
    </div>
  );
}