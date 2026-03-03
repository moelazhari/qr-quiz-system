'use client';

import { Quiz } from '@/types';
import { MouseEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuizCardProps {
    quiz: Quiz;
    onDelete: () => void;
    onToggle: (quiz: Quiz) => void;
    onViewStats: () => void;
    delay?: number;
}

export default function QuizCard({ quiz, onDelete, onToggle, onViewStats, delay = 0 }: QuizCardProps) {
    const router = useRouter();
    const [showQR, setShowQR] = useState(false);
    const [loadingToggle, setLoadingToggle] = useState(false); // Loading state for button
    const manageUrl = `/dashboard/quizzes/${quiz.id}`;

    const downloadQR = () => {
        if (!quiz.qr_code) return;

        const link = document.createElement('a');
        link.href = quiz.qr_code;
        link.download = `${quiz.title.replace(/\s+/g, '-')}-QR.png`;
        link.click();
    };

    const toggleQR = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setShowQR(!showQR);
    };

    const handleToggleClick = async (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setLoadingToggle(true);
        await onToggle(quiz);
        setLoadingToggle(false);
    };

    const handleCardClick = () => {
        router.push(manageUrl);
    };

    return (
        <div
            onClick={handleCardClick}
            className="relative overflow-hidden bg-gradient-to-br from-slate-700/60 to-slate-800/70 border border-slate-600 rounded-2xl p-6 hover:border-indigo-400/60 transition-all duration-300 slide-in shadow-md hover:shadow-indigo-900/30 hover:shadow-xl cursor-pointer"
            style={{ animationDelay: `${delay}s` }}
        >
            <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{quiz.title}</h3>
                    <p className="text-slate-400 text-sm line-clamp-2">{quiz.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            quiz.is_active
                                ? 'bg-green-900/40 text-green-300 border-green-500/60'
                                : 'bg-amber-900/40 text-amber-200 border-amber-500/60'
                        }`}
                    >
                        {quiz.is_active ? 'Active' : 'Inactive'}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(manageUrl);
                        }}
                        className="w-10 h-10 shrink-0 rounded-lg border border-slate-500 bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center transition-colors"
                        aria-label="Open quiz settings"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h5m4 0h7M9 6a2 2 0 104 0 2 2 0 10-4 0zM4 12h9m4 0h3M13 12a2 2 0 104 0 2 2 0 10-4 0zM4 18h11m4 0h1M15 18a2 2 0 104 0 2 2 0 10-4 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center text-slate-300 text-sm">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {quiz.questions.length} {quiz.questions.length === 1 ? 'Question' : 'Questions'}
                </div>
                <div className="flex items-center text-slate-300 text-sm">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Created {quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : 'Recently'}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                    onClick={toggleQR}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-2"
                >
                    {showQR ? 'Hide' : 'Show'} QR
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewStats();
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-2"
                >
                    Stats
                </button>
            </div>

            {showQR && quiz.qr_code && (
                <div className="mb-4 p-4 bg-white rounded-lg fade-in text-center">
                    <img src={quiz.qr_code} alt={`QR Code for ${quiz.title}`} className="w-full max-w-[200px] mx-auto mb-3" />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            downloadQR();
                        }}
                        className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors duration-300"
                    >
                        Download QR Code
                    </button>
                </div>
            )}

            {/* Bottom Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={handleToggleClick}
                    disabled={loadingToggle}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-300 border ${
                        quiz.is_active
                            ? `bg-red-900/40 text-red-200 border-red-500/60 hover:bg-red-900/60 ${loadingToggle ? 'opacity-70 cursor-wait' : ''}`
                            : `bg-emerald-900/40 text-emerald-200 border-emerald-500/60 hover:bg-emerald-900/60 ${loadingToggle ? 'opacity-70 cursor-wait' : ''}`
                    }`}
                >
                    {loadingToggle ? 'Processing...' : quiz.is_active ? 'Deactivate' : 'Activate'}
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-red-300 rounded-lg text-sm font-semibold transition-all duration-300"
                >
                    Delete
                </button>
            </div>
        </div>
    );
}
