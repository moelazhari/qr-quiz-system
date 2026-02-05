'use client';

import { useState, useEffect } from 'react';
import { Quiz, Submission } from '@/types';

interface QuizStatsModalProps {
  quiz: Quiz;
  onClose: () => void;
}

export default function QuizStatsModal({ quiz, onClose }: QuizStatsModalProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(`/api/submissions?quizId=${quiz.id}`);
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
    if (submissions.length === 0) {
      return { average: 0, highest: 0, lowest: 0 };
    }

    const percentages = submissions.map(s => (s.score / s.total_points) * 100);
    const average = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);

    return {
      average: Math.round(average),
      highest: Math.round(highest),
      lowest: Math.round(lowest),
    };
  };

  const stats = calculateStats();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{quiz.title}</h2>
              <p className="text-slate-400">Quiz Statistics</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading statistics...</p>
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Submissions</p>
                  <p className="text-3xl font-bold text-white">{submissions.length}</p>
                </div>

                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-indigo-400">{stats.average}%</p>
                </div>

                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Highest Score</p>
                  <p className="text-3xl font-bold text-green-400">{stats.highest}%</p>
                </div>

                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Lowest Score</p>
                  <p className="text-3xl font-bold text-red-400">{stats.lowest}%</p>
                </div>
              </div>

              {/* Submissions List */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Student Submissions</h3>

                {submissions.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-slate-400">No submissions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((submission) => {
                      const percentage = Math.round((submission.score / submission.total_points) * 100);
                      const getGradeColor = (pct: number) => {
                        if (pct >= 90) return 'bg-green-900/30 text-green-400 border-green-500';
                        if (pct >= 70) return 'bg-blue-900/30 text-blue-400 border-blue-500';
                        if (pct >= 50) return 'bg-yellow-900/30 text-yellow-400 border-yellow-500';
                        return 'bg-red-900/30 text-red-400 border-red-500';
                      };

                      return (
                        <div
                          key={submission.id}
                          className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 hover:bg-slate-700 transition-all duration-300"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-white mb-1">{submission.student_name}</p>
                              <p className="text-slate-400 text-sm">{submission.student_email}</p>
                              <p className="text-slate-500 text-xs mt-1">
                                {new Date(submission.submitted_at).toLocaleString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm text-slate-400">Score</p>
                                <p className="text-xl font-bold text-white">
                                  {submission.score} / {submission.total_points}
                                </p>
                              </div>

                              <div className={`px-4 py-2 rounded-lg border-2 ${getGradeColor(percentage)} min-w-[80px] text-center`}>
                                <p className="text-2xl font-bold">{percentage}%</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
