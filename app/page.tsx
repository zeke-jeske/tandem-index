// app/page.tsx
"use client";
import VideoBackground from '@/components/VideoBackground';
import Link from 'next/link';

export default function Home() {
  return (
    <VideoBackground videoSrc="/videos/book-pages.mp4">
      <div className="text-center p-4 w-full max-w-2xl mx-auto">
        <h1 className="text-7xl text-mint tracking-wide font-serif mb-6">Tandem Index</h1>
        <p className="text-xl text-white font-public-sans md:text-2xl mb-8">AI-powered book indexing that works alongside you.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/index" 
            className="px-6 py-3 !text-white bg-darkRed rounded-lg transition-colors"
          >
            Try the Demo
          </Link>
          <Link
            href="/index"
          className="px-6 py-3 text-white border-2 bg-transparent border-white rounded-lg hover:bg-white hover:text-navy transition-colors"
          >
            Generate Index
          </Link>
        </div>
      </div>
    </VideoBackground>
  );
}