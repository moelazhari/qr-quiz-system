'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Quiz } from '@/types';
import Link from 'next/link';

type QuizAnswerValue = string | number;
type QuizAnswers = Record<string, QuizAnswerValue>;

export default function QuizPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [answers, setAnswers] = useState<QuizAnswers>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push(`/login?callbackUrl=/quiz/${quizId}`);
        } else if (status === 'authenticated') {
            fetchQuiz();
        }
    }, [status, quizId]);

    const fetchQuiz = async () => {
        try {
            const response = await fetch(`/api/quizzes?id=${quizId}`);
            if (response.ok) {
                const data = await response.json();

                if (!data.is_active) {
                    setError('This quiz is not currently active.');
                } else {
                    setQuiz(data);
                }
            } else {
                setError('Quiz not found.');
            }
        } catch (err) {
            setError('Failed to load quiz.');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (questionId: string, value: QuizAnswerValue) => {
        setAnswers({ ...answers, [questionId]: value });
    };

    const isAnswered = (question: Quiz['questions'][number]) => {
        const value = answers[question.id];
        const questionType = question.type || 'mcq';

        if (questionType === 'mcq') {
            return typeof value === 'number';
        }

        return typeof value === 'string' && value.trim().length > 0;
    };

    const answeredCount = quiz ? quiz.questions.filter((question) => isAnswered(question)).length : 0;

    const handleSubmit = async () => {
        if (!quiz || answeredCount !== quiz.questions.length) {
            alert('Please answer all questions before submitting.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizId, answers }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to submit quiz');

            setResult(data);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Failed to submit quiz. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading quiz...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="card max-w-md w-full text-center">
                    <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <Link href="/dashboard" className="btn-primary inline-block">
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (submitted && result) {
        const percentage = result.percentage;
        const getGrade = (pct: number) => {
            if (pct >= 90) return { grade: 'A', color: 'text-green-400', message: 'Excellent!' };
            if (pct >= 80) return { grade: 'B', color: 'text-blue-400', message: 'Great job!' };
            if (pct >= 70) return { grade: 'C', color: 'text-yellow-400', message: 'Good work!' };
            if (pct >= 60) return { grade: 'D', color: 'text-orange-400', message: 'Keep practicing!' };
            return { grade: 'F', color: 'text-red-400', message: 'Keep trying!' };
        };
        const gradeInfo = getGrade(percentage);

        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="card max-w-2xl w-full text-center fade-in">
                    <div className="mb-6">
                        <div className={`w-32 h-32 mx-auto mb-4 rounded-full border-8 ${gradeInfo.color} border-opacity-50 flex items-center justify-center bg-slate-700`}>
                            <span className={`text-6xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">{gradeInfo.message}</h2>
                        <p className="text-slate-400">You've completed the quiz</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                            <p className="text-slate-400 text-sm mb-1">Your Score</p>
                            <p className="text-3xl font-bold text-white">{result.score} / {result.totalPoints}</p>
                        </div>
                        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                            <p className="text-slate-400 text-sm mb-1">Percentage</p>
                            <p className={`text-3xl font-bold ${gradeInfo.color}`}>{Math.round(percentage)}%</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Link href="/dashboard" className="btn-primary w-full block">
                            View Quiz History
                        </Link>
                        <p className="text-slate-500 text-sm">
                            Check your dashboard to see all your quiz results
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!quiz) return null;

    const progress = (answeredCount / quiz.questions.length) * 100;

    return (
        <div className="min-h-screen p-4 pb-24">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8 text-center fade-in">
                    <h1 className="text-4xl font-bold gradient-text mb-2">{quiz.title}</h1>
                    <p className="text-slate-400 mb-4">{quiz.description}</p>
                    <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {quiz.questions.length} Questions
                        </span>
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            By {quiz.teacher_name}
                        </span>
                    </div>
                </div>

                <div className="card mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-300">Progress</span>
                        <span className="text-sm font-medium text-indigo-400">{answeredCount} / {quiz.questions.length}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                <div className="space-y-6">
                    {quiz.questions.map((question, index) => {
                        const questionType = question.type || 'mcq';

                        return (
                            <div key={question.id} className="card slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-white mb-1">{question.question}</h3>
                                        <p className="text-slate-500 text-sm">{question.points} {question.points === 1 ? 'point' : 'points'}</p>
                                    </div>
                                </div>

                                {questionType === 'mcq' ? (
                                    <div className="space-y-3">
                                        {(question.options || []).map((option, optionIndex) => (
                                            <button
                                                key={optionIndex}
                                                onClick={() => handleAnswerChange(question.id, optionIndex)}
                                                className={`quiz-option w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3 border-2 ${
                                                    answers[question.id] === optionIndex
                                                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                                        : 'border-slate-500 bg-slate-800 text-slate-200 hover:bg-slate-700'
                                                }`}
                                            >
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                    answers[question.id] === optionIndex
                                                        ? 'border-white bg-white'
                                                        : 'border-slate-500'
                                                }`}>
                                                    {answers[question.id] === optionIndex && (
                                                        <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span>{option}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {questionType === 'diagram' && question.diagramImageUrl && (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
                                                <img
                                                    src={question.diagramImageUrl}
                                                    alt="Question diagram"
                                                    className="w-full max-h-80 object-contain rounded"
                                                />
                                            </div>
                                        )}
                                        <textarea
                                            value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
                                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                            className="input-field min-h-[110px]"
                                            placeholder={questionType === 'diagram' ? 'Enter your answer based on the diagram' : 'Enter your answer'}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-700 p-4 backdrop-blur-sm">
                    <div className="max-w-3xl mx-auto">
                        {error && (
                            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-lg mb-3 text-sm">
                                {error}
                            </div>
                        )}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || answeredCount !== quiz.questions.length}
                            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Submitting...
                                </span>
                            ) : answeredCount !== quiz.questions.length ? (
                                `Answer all questions (${answeredCount}/${quiz.questions.length})`
                            ) : (
                                'Submit Quiz'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
