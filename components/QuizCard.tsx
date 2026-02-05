'use client';

import { Quiz } from '@/types';
import { useState } from 'react';

interface QuizCardProps {
    quiz: Quiz;
    onDelete: () => void;
    onToggle: (quiz: Quiz) => void;
    onViewStats: () => void;
    delay?: number;
}

export default function QuizCard({ quiz, onDelete, onToggle, onViewStats, delay = 0 }: QuizCardProps) {
    const [showQR, setShowQR] = useState(false);
    const [loadingToggle, setLoadingToggle] = useState(false); // Loading state for button

    const downloadQR = () => {
        if (!quiz.qr_code) return;

        const link = document.createElement('a');
        link.href = quiz.qr_code;
        link.download = `${quiz.title.replace(/\s+/g, '-')}-QR.png`;
        link.click();
    };

    const toggleQR = () => setShowQR(!showQR);

    const handleToggleClick = async () => {
        setLoadingToggle(true);
        await onToggle(quiz);
        setLoadingToggle(false);
    };

    return (
        <div
            className="bg-slate-700/50 border border-slate-600 rounded-xl p-6 hover:bg-slate-700 hover:border-indigo-500/50 transition-all duration-300 slide-in shadow-md"
            style={{ animationDelay: `${delay}s` }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{quiz.title}</h3>
                    <p className="text-slate-400 text-sm line-clamp-2">{quiz.description}</p>
                </div>
                <div
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        quiz.is_active
                            ? 'bg-green-900/50 text-green-400 border border-green-500/50'
                            : 'bg-slate-600 text-slate-400'
                    }`}
                >
                    {quiz.is_active ? 'Active' : 'Inactive'}
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
                    onClick={onViewStats}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-2"
                >
                    Stats
                </button>
            </div>

            {showQR && quiz.qr_code && (
                <div className="mb-4 p-4 bg-white rounded-lg fade-in text-center">
                    <img src={quiz.qr_code} alt={`QR Code for ${quiz.title}`} className="w-full max-w-[200px] mx-auto mb-3" />
                    <button
                        onClick={downloadQR}
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
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-300 ${
                        quiz.is_active
                            ? `bg-green-600 hover:bg-green-700 text-white ${loadingToggle ? 'opacity-70 cursor-wait' : ''}`
                            : `bg-slate-600 hover:bg-slate-500 text-white ${loadingToggle ? 'opacity-70 cursor-wait' : ''}`
                    }`}
                >
                    {loadingToggle ? 'Processing...' : quiz.is_active ? 'Deactivate' : 'Activate'}
                </button>

                <button
                    onClick={onDelete}
                    className="px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-red-300 rounded-lg text-sm font-semibold transition-all duration-300"
                >
                    Delete
                </button>
            </div>
        </div>
    );
}
