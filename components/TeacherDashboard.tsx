'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Quiz } from '@/types';
import QuizCard from './QuizCard';
import QuizStatsModal from './QuizStatsModal';

export default function TeacherDashboard() {
    const { data: session } = useSession();
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
    const [showStatsModal, setShowStatsModal] = useState(false);

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const res = await fetch('/api/quizzes');
            if (res.ok) {
                const data = await res.json();
                setQuizzes(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteQuiz = async (quizId: number) => {
        if (!confirm('Are you sure you want to delete this quiz?')) return;

        try {
            const res = await fetch(`/api/quizzes?id=${quizId}`, { method: 'DELETE' });
            if (res.ok) {
                setQuizzes(quizzes.filter(q => q.id !== quizId));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleQuiz = async (quiz: Quiz) => {
        try {
            const res = await fetch('/api/quizzes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: quiz.id, is_active: !quiz.is_active }),
            });

            if (res.ok) {
                setQuizzes(quizzes.map(q => (q.id === quiz.id ? { ...q, is_active: !q.is_active } : q)));
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen p-6 bg-slate-800">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="fade-in">
                        <h1 className="text-4xl font-bold gradient-text mb-2">Teacher Dashboard</h1>
                        <p className="text-slate-400">
                            Welcome back, <span className="text-white font-semibold">{session?.user?.name}</span>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => router.push('/dashboard/quizzes/new')} className="btn-primary flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Quiz
                        </button>
                        <button onClick={() => signOut({ callbackUrl: '/' })} className="btn-secondary">
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="card slide-in">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">Total Quizzes</p>
                                <p className="text-3xl font-bold text-white">{quizzes.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="card slide-in" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">Active Quizzes</p>
                                <p className="text-3xl font-bold text-white">{quizzes.filter(q => q.is_active).length}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="card slide-in" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">Total Questions</p>
                                <p className="text-3xl font-bold text-white">{quizzes.reduce((acc, q) => acc + q.questions.length, 0)}</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quizzes List */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-6 text-white">Your Quizzes</h2>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-slate-400">Loading quizzes...</p>
                        </div>
                    ) : quizzes.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400 mb-4">No quizzes yet</p>
                            <button onClick={() => router.push('/dashboard/quizzes/new')} className="btn-primary">
                                Create Your First Quiz
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {quizzes.map((quiz, index) => (
                                <QuizCard
                                    key={quiz.id}
                                    quiz={quiz}
                                    onDelete={() => handleDeleteQuiz(quiz.id!)}
                                    onToggle={handleToggleQuiz}
                                    onViewStats={() => {
                                        setSelectedQuiz(quiz);
                                        setShowStatsModal(true);
                                    }}
                                    delay={index * 0.1}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showStatsModal && selectedQuiz && (
                <QuizStatsModal
                    quiz={selectedQuiz}
                    onClose={() => {
                        setShowStatsModal(false);
                        setSelectedQuiz(null);
                    }}
                />
            )}
        </div>
    );
}
