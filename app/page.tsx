'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 fade-in">
          <div className="inline-block mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center pulse-glow">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-6xl font-bold mb-4 gradient-text">
            QR Quiz System
          </h1>
          <p className="text-xl text-slate-300 mb-2">
            Interactive Quiz Platform with QR Code Access
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card slide-in hover:scale-105">
            <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">For Teachers</h3>
            <p className="text-slate-400 mb-4">Create engaging quizzes, generate QR codes, and track student performance with detailed analytics.</p>
            <ul className="text-sm text-slate-300 space-y-2 mb-6">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                Quiz creation & management
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                QR code generation
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                Real-time statistics
              </li>
            </ul>
          </div>

          <div className="card slide-in hover:scale-105" style={{ animationDelay: '0.1s' }}>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">For Students</h3>
            <p className="text-slate-400 mb-4">Access quizzes instantly via QR codes, submit answers, and track your progress over time.</p>
            <ul className="text-sm text-slate-300 space-y-2 mb-6">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                Quick QR code access
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                Instant feedback
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                Quiz history tracking
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/login" className="btn-primary w-full sm:w-auto text-center">
            Sign In
          </Link>
          <Link href="/register" className="btn-secondary w-full sm:w-auto text-center">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
