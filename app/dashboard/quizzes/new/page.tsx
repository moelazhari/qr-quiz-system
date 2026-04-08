'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Question } from '@/types';
import DiagramBuilder from '@/components/DiagramBuilder';
import { createEmptyDiagram, normalizeDiagram, validateMeriseDiagram } from '@/lib/diagram';

const EMPTY_MCQ_OPTIONS = ['', '', '', ''];

function normalizeQuestion(question: Question): Question {
    const rawType = (question.type as string) || 'mcq';
    const type: 'mcq' | 'text' | 'diagram' = rawType === 'mcq' ? 'mcq' : rawType === 'diagram' ? 'diagram' : 'text';

    if (type === 'mcq') {
        const rawOptions = question.options || EMPTY_MCQ_OPTIONS;
        const options = [...rawOptions, ...EMPTY_MCQ_OPTIONS].slice(0, 4);
        return {
            ...question,
            type,
            gradingMode: 'auto',
            questionImageUrl: question.questionImageUrl || question.diagramImageUrl || '',
            options,
            correctAnswer: typeof question.correctAnswer === 'number' ? question.correctAnswer : 0,
            correctTextAnswer: undefined,
            acceptedTextAnswers: undefined,
            requiredKeywords: undefined,
            diagramImageUrl: undefined,
        };
    }

    if (type === 'diagram') {
        return {
            ...question,
            type,
            gradingMode: 'auto',
            questionImageUrl: question.questionImageUrl || '',
            options: undefined,
            correctAnswer: undefined,
            correctTextAnswer: undefined,
            acceptedTextAnswers: undefined,
            requiredKeywords: undefined,
            diagramImageUrl: undefined,
            diagramTemplate: normalizeDiagram(question.diagramTemplate),
        };
    }

    return {
        ...question,
        type,
        gradingMode: question.gradingMode || 'manual',
        questionImageUrl: question.questionImageUrl || question.diagramImageUrl || '',
        options: undefined,
        correctAnswer: undefined,
        correctTextAnswer: question.correctTextAnswer || '',
        acceptedTextAnswers: question.acceptedTextAnswers || [],
        requiredKeywords: question.requiredKeywords || [],
        diagramImageUrl: undefined,
    };
}

function sanitizeQuestions(questions: Question[]): Question[] {
    return questions.map((question) => {
        const normalized = normalizeQuestion(question);

        if (normalized.type === 'mcq') {
            return {
                id: normalized.id,
                type: 'mcq',
                gradingMode: 'auto',
                question: normalized.question.trim(),
                questionImageUrl: (normalized.questionImageUrl || '').trim(),
                options: (normalized.options || []).map((opt) => opt.trim()),
                correctAnswer: normalized.correctAnswer || 0,
                points: normalized.points,
            };
        }

        if (normalized.type === 'diagram') {
            return {
                id: normalized.id,
                type: 'diagram',
                gradingMode: 'auto',
                question: normalized.question.trim(),
                questionImageUrl: (normalized.questionImageUrl || '').trim(),
                diagramTemplate: normalizeDiagram(normalized.diagramTemplate),
                points: normalized.points,
            };
        }

        return {
            id: normalized.id,
            type: 'text',
            gradingMode: normalized.gradingMode || 'manual',
            question: normalized.question.trim(),
            questionImageUrl: (normalized.questionImageUrl || '').trim(),
            correctTextAnswer: (normalized.correctTextAnswer || '').trim(),
            acceptedTextAnswers: (normalized.acceptedTextAnswers || []).map((item) => item.trim()).filter(Boolean),
            requiredKeywords: (normalized.requiredKeywords || []).map((item) => item.trim()).filter(Boolean),
            points: normalized.points,
        };
    });
}

export default function CreateQuizPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [resultsReleaseMode, setResultsReleaseMode] = useState<'immediate' | 'after_review'>('immediate');
    const [questions, setQuestions] = useState<Question[]>([
        {
            id: `${Date.now()}-1`,
            type: 'mcq',
            gradingMode: 'auto',
            question: '',
            options: [...EMPTY_MCQ_OPTIONS],
            correctAnswer: 0,
            points: 1,
        },
    ]);
    const [saving, setSaving] = useState(false);
    const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
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
            gradingMode: 'auto',
            question: '',
            questionImageUrl: '',
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
            if (!q.question.trim() && !(q.questionImageUrl || '').trim()) {
                return `Question ${i + 1}: add question text or an image.`;
            }
            if (!Number.isInteger(q.points) || q.points < 1) return `Question ${i + 1}: points must be at least 1.`;

            if (q.type === 'mcq') {
                if ((q.options || []).some((opt) => !opt.trim())) return `Question ${i + 1}: all options are required.`;
            } else if (q.type === 'diagram') {
                if ((q.diagramTemplate?.nodes || []).length === 0) {
                    return `Question ${i + 1}: build the expected diagram.`;
                }
                const meriseIssues = validateMeriseDiagram(q.diagramTemplate);
                if (meriseIssues.length > 0) {
                    return `Question ${i + 1}: ${meriseIssues[0]}`;
                }
            } else {
                if ((q.gradingMode || 'manual') === 'auto' && !(q.correctTextAnswer || '').trim()) {
                    return `Question ${i + 1}: expected answer is required for auto grading.`;
                }
            }
        }

        return '';
    };

    const handleQuestionImageUpload = async (index: number, file: File | null) => {
        if (!file) return;
        const questionId = questions[index]?.id;
        if (!questionId) return;

        setUploadingQuestionId(questionId);
        setToast(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/uploads', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to upload image');
            }

            updateQuestion(index, { questionImageUrl: data.url });
            setToast({ type: 'success', message: 'Image uploaded successfully.' });
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to upload image' });
        } finally {
            setUploadingQuestionId(null);
        }
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
                    results_release_mode: resultsReleaseMode,
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
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Release Grades</label>
                            <select
                                value={resultsReleaseMode}
                                onChange={(e) => setResultsReleaseMode(e.target.value as 'immediate' | 'after_review')}
                                className="input-field max-w-md"
                            >
                                <option value="immediate">Immediately after submission</option>
                                <option value="after_review">After teacher review</option>
                            </select>
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
                                                <option value="diagram">Diagram Design</option>
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
                                    <label className="block text-sm text-slate-300 mb-2">Question Text (optional if image is provided)</label>
                                    <input
                                        value={q.question}
                                        onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                        className="input-field"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-sm text-slate-300">Question Image (optional)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleQuestionImageUpload(index, e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-500 file:bg-slate-700 file:text-slate-200"
                                    />
                                    {uploadingQuestionId === q.id && (
                                        <p className="text-xs text-indigo-300">Uploading image...</p>
                                    )}
                                    <input
                                        value={q.questionImageUrl || ''}
                                        onChange={(e) => updateQuestion(index, { questionImageUrl: e.target.value })}
                                        className="input-field"
                                        placeholder="Or paste image URL"
                                    />
                                    {q.questionImageUrl && (
                                        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
                                            <img src={q.questionImageUrl} alt="Question preview" className="max-h-48 object-contain rounded mx-auto" />
                                            <button
                                                onClick={() => updateQuestion(index, { questionImageUrl: '' })}
                                                className="mt-3 px-3 py-2 text-xs rounded-md border border-red-500/60 text-red-200 bg-red-900/30 hover:bg-red-900/50"
                                            >
                                                Remove Image
                                            </button>
                                        </div>
                                    )}
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
                                ) : q.type === 'text' ? (
                                    <>
                                        <div>
                                            <label className="block text-sm text-slate-300 mb-2">Grading Mode</label>
                                            <select
                                                value={q.gradingMode || 'manual'}
                                                onChange={(e) => updateQuestion(index, { gradingMode: e.target.value as 'auto' | 'manual' })}
                                                className="input-field max-w-[220px]"
                                            >
                                                <option value="manual">Manual by teacher</option>
                                                <option value="auto">Auto-grade</option>
                                            </select>
                                        </div>
                                        {(q.gradingMode || 'manual') === 'auto' && (
                                            <div>
                                                <label className="block text-sm text-slate-300 mb-2">Expected Text Answer (for auto grading)</label>
                                                <input
                                                    value={q.correctTextAnswer || ''}
                                                    onChange={(e) => updateQuestion(index, { correctTextAnswer: e.target.value })}
                                                    className="input-field"
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100">
                                            Students will build a diagram from draggable shapes. Auto-grading compares elements, attributes, links, and cardinalities with the expected model below.
                                        </div>
                                        <DiagramBuilder
                                            value={q.diagramTemplate || createEmptyDiagram()}
                                            onChange={(diagramTemplate) => updateQuestion(index, { diagramTemplate })}
                                            title="Expected Diagram"
                                            description="Build the reference model that student submissions will be compared against."
                                        />
                                    </div>
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
