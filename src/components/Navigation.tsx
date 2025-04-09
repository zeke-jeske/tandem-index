"use client";
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const Navigation = () => {
  const pathname = usePathname();
  
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex justify-between items-center h-14">
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              Tandem Index
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <Link
              href="/"
              className={`${
                pathname === '/'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              } px-3 py-2 text-sm font-medium`}
            >
              Verification
            </Link>
            <Link
              href="/index"
              className={`${
                pathname === '/index'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              } px-3 py-2 text-sm font-medium`}
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
            href="/"
            className={`${
              pathname === '/'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            } flex-1 py-2 text-center text-sm font-medium`}
          >
            Verification
          </Link>
          <Link
            href="/index"
            className={`${
              pathname === '/index'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            } flex-1 py-2 text-center text-sm font-medium`}
          >
            Generate Index
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;