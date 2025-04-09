import IndexGenerator from '@/components/IndexGenerator';
import Navigation from '@/components/Navigation';

export default function IndexPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-6">
        <IndexGenerator />
      </div>
    </div>
  );
}