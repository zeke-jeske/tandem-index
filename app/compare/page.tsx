"use client";

import { useEffect, useState } from 'react';
import IndexComparison from '@/components/IndexComparison';
import Navigation from '@/components/Navigation';

export default function ComparePage() {
  // Use client-side rendering to avoid prerendering issues
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    // Show a simple loading state during server-side rendering
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading Tandem Index...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <div className="py-6 bg-gray-100">
        <IndexComparison />
      </div>
    </div>
  );
} 