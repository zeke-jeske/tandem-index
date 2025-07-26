"use client";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const Navigation = () => {
  const pathname = usePathname();
  
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex justify-between items-center h-14">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <Image 
                src="/images/logo1.png" 
                alt="Tandem Index Logo" 
                width={120} 
                height={32} 
                className="mr-2"
              />
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <Link
              href="/verify"
              className={`${
                pathname === '/verify'
                  ? 'text-navy border-b-2 border-navy'
                  : 'text-gray-500 hover:text-gray-700'
              } px-3 py-2 text-1.5rem font-sans`}
            >
              Verification
            </Link>
            <Link
              href="/compare"
              className={`${
                pathname === '/compare'
                  ? 'text-navy border-b-2 border-navy'
                  : 'text-gray-500 hover:text-gray-700'
              } px-3 py-2 text-1.5rem font-medium`}
            >
              Compare Indexes
            </Link>
            <Link
              href="/generator"
              className={`${
                pathname === '/generator'
                  ? 'text-navy border-b-2 border-navy'
                  : 'text-gray-500 hover:text-gray-700'
              } px-3 py-2 text-1.5rem font-medium`}
            >
              Generate Index
            </Link>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="flex">
          <Link
            href="/verify"
            className={`${
              pathname === '/verify'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            } flex-1 py-2 text-center text-sm font-medium`}
          >
            Verification
          </Link>
          <Link
            href="/compare"
            className={`${
              pathname === '/compare'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            } flex-1 py-2 text-center text-sm font-medium`}
          >
            Compare
          </Link>
          <Link
            href="/generator"
            className={`${
              pathname === '/generator'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            } flex-1 py-2 text-center text-sm font-medium`}
          >
            Generate
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;