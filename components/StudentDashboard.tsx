'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Submission } from '@/types';
import Link from 'next/link';
import { formatScore } from '@/lib/format';

export default function StudentDashboard() {
  const { data: session } = useSession();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/submissions');
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const releasedSubmissions = submissions.filter((submission) => submission.is_released !== false);
    if (releasedSubmissions.length === 0) return { average: 0, total: submissions.length, highest: 0 };

    const percentages = releasedSubmissions.map(s => (s.score / s.total_points) * 100);
    const average = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const highest = Math.max(...percentages);

    return {
      average: Math.round(average),
      total: submissions.length,
      highest: Math.round(highest),
    };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="fade-in">
            <h1 className="text-4xl font-bold gradient-text mb-2">Student Dashboard</h1>
            <p className="text-slate-400">
              Welcome back, <span className="text-white font-semibold">{session?.user?.name}</span>
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="btn-secondary"
          >
            Sign Out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card slide-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Quizzes Taken</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card slide-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Average Score</p>
                <p className="text-3xl font-bold text-white">{stats.average}%</p>
              </div>
              <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card slide-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Best Score</p>
                <p className="text-3xl font-bold text-white">{stats.highest}%</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* How to Access Quizzes */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">Access Quizzes</h2>
          <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-white">Scan QR Code to Start</h3>
                <p className="text-slate-300 mb-3">
                  To take a quiz, scan the QR code provided by your teacher using your phone's camera. 
                  You'll be redirected to the quiz page where you can answer questions and submit your responses.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz History */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 text-white">Quiz History</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading history...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-slate-400 mb-2">No quiz submissions yet</p>
              <p className="text-slate-500 text-sm">Scan a QR code from your teacher to take your first quiz</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission, index) => {
                const isReleased = submission.is_released !== false;
                const percentage = Math.round((submission.score / submission.total_points) * 100);
                const getGradeColor = (pct: number) => {
                  if (pct >= 90) return 'text-green-400 bg-green-900/30 border-green-500';
                  if (pct >= 70) return 'text-blue-400 bg-blue-900/30 border-blue-500';
                  if (pct >= 50) return 'text-yellow-400 bg-yellow-900/30 border-yellow-500';
                  return 'text-red-400 bg-red-900/30 border-red-500';
                };

                return (
                  <div 
                    key={submission.id}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg p-5 hover:bg-slate-700 transition-all duration-300 slide-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {submission.quiz_title}
                        </h3>
                        <p className="text-slate-400 text-sm">
                          Submitted on {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {isReleased ? (
                          <>
                            <div className="text-right">
                              <p className="text-sm text-slate-400 mb-1">Score</p>
                              <p className="text-2xl font-bold text-white">
                                {formatScore(Number(submission.score))} / {formatScore(Number(submission.total_points))}
                              </p>
                            </div>
                            <div className={`px-4 py-2 rounded-lg border-2 ${getGradeColor(percentage)}`}>
                              <p className="text-2xl font-bold">{percentage}%</p>
                            </div>
                          </>
                        ) : (
                          <div className="px-4 py-2 rounded-lg border-2 border-amber-500 bg-amber-900/30 text-amber-200">
                            <p className="text-sm font-semibold">Pending Review</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
