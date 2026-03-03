'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Question } from '@/types';

const EMPTY_MCQ_OPTIONS = ['', '', '', ''];

function normalizeQuestion(question: Question): Question {
    const type = question.type || 'mcq';

    if (type === 'mcq') {
        const rawOptions = question.options || EMPTY_MCQ_OPTIONS;
        const options = [...rawOptions, ...EMPTY_MCQ_OPTIONS].slice(0, 4);
        return {
            ...question,
            type,
            options,
            correctAnswer: typeof question.correctAnswer === 'number' ? question.correctAnswer : 0,
            correctTextAnswer: undefined,
            diagramImageUrl: undefined,
        };
    }

    return {
        ...question,
        type,
        options: undefined,
        correctAnswer: undefined,
        correctTextAnswer: question.correctTextAnswer || '',
        diagramImageUrl: type === 'diagram' ? question.diagramImageUrl || '' : undefined,
    };
}

function sanitizeQuestions(questions: Question[]): Question[] {
    return questions.map((question) => {
        const normalized = normalizeQuestion(question);

        if (normalized.type === 'mcq') {
            return {
                id: normalized.id,
                type: 'mcq',
                question: normalized.question.trim(),
                options: (normalized.options || []).map((opt) => opt.trim()),
                correctAnswer: normalized.correctAnswer || 0,
                points: normalized.points,
            };
        }

        if (normalized.type === 'diagram') {
            return {
                id: normalized.id,
                type: 'diagram',
                question: normalized.question.trim(),
                correctTextAnswer: (normalized.correctTextAnswer || '').trim(),
                diagramImageUrl: (normalized.diagramImageUrl || '').trim(),
                points: normalized.points,
            };
        }

        return {
            id: normalized.id,
            type: 'text',
            question: normalized.question.trim(),
            correctTextAnswer: (normalized.correctTextAnswer || '').trim(),
            points: normalized.points,
        };
    });
}

export default function CreateQuizPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([
        {
            id: `${Date.now()}-1`,
            type: 'mcq',
            question: '',
            options: [...EMPTY_MCQ_OPTIONS],
            correctAnswer: 0,
            points: 1,
        },
    ]);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && (session?.user as any)?.role !== 'teacher') {
            router.push('/dashboard');
        }
    }, [status, session]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const updateQuestion = (index: number, patch: Partial<Question>) => {
        setQuestions((prev) => {
            const next = [...prev];
            next[index] = normalizeQuestion({ ...next[index], ...patch });
            return next;
        });
    };

    const updateOption = (qIndex: number, optIndex: number, value: string) => {
        setQuestions((prev) => {
            const next = [...prev];
            const question = normalizeQuestion(next[qIndex]);
            const options = [...(question.options || EMPTY_MCQ_OPTIONS)];
            options[optIndex] = value;
            next[qIndex] = { ...question, options };
            return next;
        });
    };

    const addQuestion = () => {
        const newQuestion: Question = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: 'mcq',
            question: '',
            options: [...EMPTY_MCQ_OPTIONS],
            correctAnswer: 0,
            points: 1,
        };

        setQuestions((prev) => [...prev, newQuestion]);
    };

    const deleteQuestion = (index: number) => {
        if (questions.length === 1) {
            setToast({ type: 'error', message: 'Quiz must contain at least one question.' });
            return;
        }

        setQuestions((prev) => prev.filter((_, i) => i !== index));
    };

    const validate = () => {
        if (!title.trim()) return 'Quiz title is required.';
        if (questions.length === 0) return 'At least one question is required.';

        for (let i = 0; i < questions.length; i += 1) {
            const q = normalizeQuestion(questions[i]);
            if (!q.question.trim()) return `Question ${i + 1}: text is required.`;
            if (!Number.isInteger(q.points) || q.points < 1) return `Question ${i + 1}: points must be at least 1.`;

            if (q.type === 'mcq') {
                if ((q.options || []).some((opt) => !opt.trim())) return `Question ${i + 1}: all options are required.`;
            } else {
                if (!(q.correctTextAnswer || '').trim()) return `Question ${i + 1}: expected answer is required.`;
                if (q.type === 'diagram' && !(q.diagramImageUrl || '').trim()) {
                    return `Question ${i + 1}: diagram image URL is required.`;
                }
            }
        }

        return '';
    };

    const createQuiz = async () => {
        const validationError = validate();
        if (validationError) {
            setToast({ type: 'error', message: validationError });
            return;
        }

        setSaving(true);
        setToast(null);

        try {
            const response = await fetch('/api/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    questions: sanitizeQuestions(questions),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create quiz');
            }

            router.push(`/dashboard/quizzes/${data.quizId}`);
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to create quiz' });
        } finally {
            setSaving(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading creator...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 pb-28">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm">← Back to Dashboard</Link>
                        <h1 className="text-3xl font-bold text-white mt-2">Create New Quiz</h1>
                        <p className="text-slate-400">Build your quiz in a full editor workspace</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={addQuestion} className="btn-secondary">+ Add Question</button>
                    </div>
                </div>

                {toast && (
                    <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-sm max-w-sm ${
                        toast.type === 'error'
                            ? 'bg-red-900/90 border-red-500 text-red-100'
                            : 'bg-emerald-900/90 border-emerald-500 text-emerald-100'
                    }`}>
                        {toast.message}
                    </div>
                )}

                <div className="card space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Quiz Title</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="input-field"
                                placeholder="Enter quiz title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input-field min-h-[100px]"
                                placeholder="Enter quiz description"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-700 pt-4">
                        <p className="text-slate-400 text-sm">
                            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
                        </p>
                        <button onClick={addQuestion} className="btn-secondary">+ Add Question</button>
                    </div>

                    {questions.map((question, index) => {
                        const q = normalizeQuestion(question);

                        return (
                            <div key={q.id} className="bg-slate-700/40 border border-slate-600 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-white font-semibold">Question {index + 1}</h3>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={q.type}
                                            onChange={(e) => updateQuestion(index, { type: e.target.value as Question['type'] })}
                                            className="input-field max-w-[220px]"
                                        >
                                            <option value="mcq">Multiple Choice</option>
                                            <option value="text">Text Answer</option>
                                            <option value="diagram">Diagram-Based</option>
                                        </select>
                                        <button
                                            onClick={() => deleteQuestion(index)}
                                            className="px-3 py-3 bg-red-900/40 text-red-200 border border-red-500/60 rounded-lg hover:bg-red-900/60 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Question Text</label>
                                    <input
                                        value={q.question}
                                        onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                        className="input-field"
                                    />
                                </div>

                                {q.type === 'mcq' ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-slate-300">Options</p>
                                        {(q.options || []).map((option, optionIndex) => (
                                            <div key={optionIndex} className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    checked={q.correctAnswer === optionIndex}
                                                    onChange={() => updateQuestion(index, { correctAnswer: optionIndex })}
                                                    className="w-4 h-4"
                                                />
                                                <input
                                                    value={option}
                                                    onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                                    className="input-field"
                                                    placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        {q.type === 'diagram' && (
                                            <div>
                                                <label className="block text-sm text-slate-300 mb-2">Diagram Image URL</label>
                                                <input
                                                    value={q.diagramImageUrl || ''}
                                                    onChange={(e) => updateQuestion(index, { diagramImageUrl: e.target.value })}
                                                    className="input-field"
                                                    placeholder="https://example.com/diagram.png"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-sm text-slate-300 mb-2">Expected Text Answer</label>
                                            <input
                                                value={q.correctTextAnswer || ''}
                                                onChange={(e) => updateQuestion(index, { correctTextAnswer: e.target.value })}
                                                className="input-field"
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Points</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={q.points}
                                        onChange={(e) => updateQuestion(index, { points: parseInt(e.target.value) || 1 })}
                                        className="input-field max-w-[140px]"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900/95 border-t border-slate-700 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-slate-300 text-sm">
                        Ready to publish: <span className="text-white font-semibold">{questions.length}</span> {questions.length === 1 ? 'question' : 'questions'}
                    </p>
                    <button
                        onClick={createQuiz}
                        disabled={saving}
                        className="btn-primary disabled:opacity-60 disabled:cursor-wait"
                    >
                        {saving ? 'Creating...' : 'Create Quiz'}
                    </button>
                </div>
            </div>
        </div>
    );
}
