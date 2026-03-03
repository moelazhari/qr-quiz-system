'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Answer, Question, Quiz, Submission } from '@/types';

type TabKey = 'overview' | 'questions' | 'submissions' | 'stats';

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

export default function TeacherQuizDetailsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingQuiz, setSavingQuiz] = useState(false);
    const [savingScore, setSavingScore] = useState(false);
    const [deletingQuiz, setDeletingQuiz] = useState(false);
    const [togglingQuizStatus, setTogglingQuizStatus] = useState(false);
    const [gradingAnswers, setGradingAnswers] = useState<Answer[]>([]);
    const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && (session?.user as any)?.role !== 'teacher') {
            router.push('/dashboard');
            return;
        }

        if (status === 'authenticated') {
            fetchData();
        }
    }, [status, quizId]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setToast(null);

            const [quizRes, submissionsRes] = await Promise.all([
                fetch(`/api/quizzes?id=${quizId}`),
                fetch(`/api/submissions?quizId=${quizId}`),
            ]);

            if (!quizRes.ok) {
                throw new Error('Quiz not found');
            }

            if (!submissionsRes.ok) {
                throw new Error('Failed to fetch submissions');
            }

            const quizData: Quiz = await quizRes.json();
            const teacherId = parseInt((session?.user as any)?.id || '0');
            if (quizData.teacher_id !== teacherId) {
                throw new Error('You do not have access to this quiz');
            }

            const submissionsData: Submission[] = await submissionsRes.json();
            const normalizedQuestions = (quizData.questions || []).map((q) => normalizeQuestion(q));

            setQuiz({ ...quizData, questions: normalizedQuestions });
            setDraftTitle(quizData.title);
            setDraftDescription(quizData.description || '');
            setDraftQuestions(normalizedQuestions);
            setSubmissions(submissionsData);

            if (selectedSubmission) {
                const refreshed = submissionsData.find((s) => s.id === selectedSubmission.id) || null;
                setSelectedSubmission(refreshed);
                if (refreshed) setGradingAnswers(refreshed.answers || []);
            }
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to load quiz data' });
        } finally {
            setLoading(false);
        }
    };

    const hasUnsavedChanges = useMemo(() => {
        if (!quiz) return false;
        const sameTitle = draftTitle.trim() === quiz.title;
        const sameDescription = draftDescription.trim() === (quiz.description || '');
        const sameQuestions = JSON.stringify(sanitizeQuestions(draftQuestions)) === JSON.stringify(sanitizeQuestions(quiz.questions));
        return !(sameTitle && sameDescription && sameQuestions);
    }, [quiz, draftTitle, draftDescription, draftQuestions]);

    const updateQuestion = (index: number, patch: Partial<Question>) => {
        setDraftQuestions((prev) => {
            const next = [...prev];
            next[index] = normalizeQuestion({ ...next[index], ...patch });
            return next;
        });
    };

    const updateOption = (qIndex: number, optIndex: number, value: string) => {
        setDraftQuestions((prev) => {
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

        setDraftQuestions((prev) => [...prev, newQuestion]);
        setToast({ type: 'success', message: 'New question added. Fill it in and save changes.' });
    };

    const deleteQuestion = (index: number) => {
        if (draftQuestions.length === 1) {
            setToast({ type: 'error', message: 'Quiz must contain at least one question.' });
            return;
        }

        setDraftQuestions((prev) => prev.filter((_, i) => i !== index));
        setToast({ type: 'success', message: 'Question removed. Save changes to apply.' });
    };

    const validateBeforeSave = () => {
        if (!draftTitle.trim()) return 'Title is required.';
        if (draftQuestions.length === 0) return 'At least one question is required.';

        for (let i = 0; i < draftQuestions.length; i += 1) {
            const q = normalizeQuestion(draftQuestions[i]);
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

    const saveQuizChanges = async () => {
        if (!quiz) return;

        const validationError = validateBeforeSave();
        if (validationError) {
            setToast({ type: 'error', message: validationError });
            return;
        }

        setSavingQuiz(true);
        setToast(null);

        try {
            const response = await fetch('/api/quizzes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: quiz.id,
                    title: draftTitle.trim(),
                    description: draftDescription.trim(),
                    questions: sanitizeQuestions(draftQuestions),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update quiz');
            }

            setToast({ type: 'success', message: 'Quiz updated successfully.' });
            await fetchData();
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to update quiz' });
        } finally {
            setSavingQuiz(false);
        }
    };

    const toggleQuizActive = async () => {
        if (!quiz) return;

        setToast(null);
        setTogglingQuizStatus(true);

        try {
            const response = await fetch('/api/quizzes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: quiz.id, is_active: !quiz.is_active }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update status');
            }

            setQuiz({ ...quiz, is_active: !quiz.is_active });
            setToast({ type: 'success', message: `Quiz ${!quiz.is_active ? 'activated' : 'deactivated'} successfully.` });
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to update quiz status' });
        } finally {
            setTogglingQuizStatus(false);
        }
    };

    const openSubmissionDetails = async (submissionId: number) => {
        try {
            setToast(null);
            const response = await fetch(`/api/submissions/${submissionId}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch submission details');
            }

            setSelectedSubmission(data);
            setGradingAnswers(data.answers || []);
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to fetch submission details' });
        }
    };

    const updateRegradeAnswer = (index: number, question: Question | undefined, markCorrect: boolean) => {
        setGradingAnswers((prev) =>
            prev.map((answer, i) => {
                if (i !== index) return answer;
                const maxPoints = Number(question?.points) || 0;
                return {
                    ...answer,
                    isCorrect: markCorrect,
                    points: markCorrect ? maxPoints : 0,
                };
            })
        );
    };

    const saveSubmissionRegrade = async () => {
        if (!selectedSubmission) {
            setToast({ type: 'error', message: 'Select a submission first.' });
            return;
        }

        setSavingScore(true);
        setToast(null);

        try {
            const response = await fetch(`/api/submissions/${selectedSubmission.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: gradingAnswers }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update score');
            }

            setToast({ type: 'success', message: 'Submission regraded successfully.' });
            await fetchData();
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to save regrade' });
        } finally {
            setSavingScore(false);
        }
    };

    const deleteQuiz = async () => {
        if (!quiz) return;
        if (!confirm('Are you sure you want to delete this quiz? This also removes all submissions.')) return;

        setDeletingQuiz(true);
        setToast(null);

        try {
            const response = await fetch(`/api/quizzes?id=${quiz.id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete quiz');
            }

            router.push('/dashboard');
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to delete quiz' });
        } finally {
            setDeletingQuiz(false);
        }
    };

    const stats = useMemo(() => {
        if (submissions.length === 0) {
            return { average: 0, highest: 0, lowest: 0, total: 0 };
        }

        const percentages = submissions.map((s) => (s.score / s.total_points) * 100);
        return {
            total: submissions.length,
            average: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length),
            highest: Math.round(Math.max(...percentages)),
            lowest: Math.round(Math.min(...percentages)),
        };
    }, [submissions]);

    const questionMap = useMemo(() => {
        const map = new Map<string, Question>();
        (quiz?.questions || []).forEach((q) => map.set(q.id, normalizeQuestion(q)));
        return map;
    }, [quiz]);

    const regradePreviewScore = useMemo(() => {
        return gradingAnswers.reduce((acc, answer) => acc + (Number(answer.points) || 0), 0);
    }, [gradingAnswers]);

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading quiz details...</p>
                </div>
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="card max-w-md w-full text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Quiz Not Found</h2>
                    <p className="text-slate-400 mb-6">This quiz could not be loaded.</p>
                    <Link href="/dashboard" className="btn-primary inline-block">Back to Dashboard</Link>
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
                        <h1 className="text-3xl font-bold text-white mt-2">Manage Quiz</h1>
                        <p className="text-slate-400">{quiz.title}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            quiz.is_active
                                ? 'bg-green-900/40 text-green-300 border-green-500/60'
                                : 'bg-amber-900/40 text-amber-200 border-amber-500/60'
                        }`}>
                            {quiz.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                            onClick={toggleQuizActive}
                            disabled={togglingQuizStatus}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 border disabled:opacity-60 disabled:cursor-wait ${
                                quiz.is_active
                                    ? 'bg-red-900/40 text-red-200 border-red-500/60 hover:bg-red-900/60'
                                    : 'bg-emerald-900/40 text-emerald-200 border-emerald-500/60 hover:bg-emerald-900/60'
                            }`}
                        >
                            {togglingQuizStatus ? 'Processing...' : quiz.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                            onClick={deleteQuiz}
                            disabled={deletingQuiz}
                            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 border bg-red-900/50 text-red-200 border-red-500/70 hover:bg-red-900/70 disabled:opacity-50"
                        >
                            {deletingQuiz ? 'Deleting...' : 'Delete Quiz'}
                        </button>
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

                <div className="card">
                    <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4 mb-6">
                        {(['overview', 'questions', 'submissions', 'stats'] as TabKey[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                            >
                                {{
                                    overview: 'Overview',
                                    questions: 'Edit Quiz',
                                    submissions: 'Submissions',
                                    stats: 'Stats',
                                }[tab]}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                    <p className="text-slate-400 text-sm mb-1">Title</p>
                                    <p className="text-white font-semibold">{quiz.title}</p>
                                </div>
                                <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                    <p className="text-slate-400 text-sm mb-1">Description</p>
                                    <p className="text-slate-300">{quiz.description || 'No description'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                        <p className="text-slate-400 text-sm mb-1">Questions</p>
                                        <p className="text-2xl font-bold text-white">{quiz.questions.length}</p>
                                    </div>
                                    <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                        <p className="text-slate-400 text-sm mb-1">Submissions</p>
                                        <p className="text-2xl font-bold text-white">{submissions.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                <p className="text-slate-400 text-sm mb-3">Quiz QR Code</p>
                                {quiz.qr_code ? (
                                    <img src={quiz.qr_code} alt={`QR for ${quiz.title}`} className="w-full max-w-[260px] mx-auto" />
                                ) : (
                                    <p className="text-slate-400">QR code unavailable</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'questions' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Quiz Title</label>
                                    <input
                                        value={draftTitle}
                                        onChange={(e) => setDraftTitle(e.target.value)}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                    <textarea
                                        value={draftDescription}
                                        onChange={(e) => setDraftDescription(e.target.value)}
                                        className="input-field min-h-[90px]"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <p className="text-slate-400 text-sm">
                                    {draftQuestions.length} {draftQuestions.length === 1 ? 'question' : 'questions'}
                                </p>
                                <button onClick={addQuestion} className="btn-secondary">
                                    + Add Question
                                </button>
                            </div>

                            {draftQuestions.map((question, index) => {
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
                    )}

                    {activeTab === 'submissions' && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                {submissions.length === 0 ? (
                                    <p className="text-slate-400">No submissions yet.</p>
                                ) : (
                                    submissions.map((submission) => {
                                        const pct = Math.round((submission.score / submission.total_points) * 100);
                                        return (
                                            <button
                                                key={submission.id}
                                                onClick={() => openSubmissionDetails(submission.id!)}
                                                className="w-full text-left bg-slate-700/40 border border-slate-600 rounded-lg p-4 hover:bg-slate-700 transition-colors"
                                            >
                                                <p className="text-white font-semibold">{submission.student_name}</p>
                                                <p className="text-slate-400 text-sm">{submission.student_email}</p>
                                                <p className="text-slate-300 text-sm mt-2">Score: {submission.score}/{submission.total_points} ({pct}%)</p>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                                {!selectedSubmission ? (
                                    <p className="text-slate-400">Select a submission to view details.</p>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-white font-semibold">{selectedSubmission.student_name}</p>
                                            <p className="text-slate-400 text-sm">{selectedSubmission.student_email}</p>
                                            <p className="text-slate-500 text-xs mt-1">{new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                                            <p className="text-indigo-300 text-sm mt-2">
                                                Final Score (preview): {regradePreviewScore} / {selectedSubmission.total_points}
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            {gradingAnswers.map((answer, idx) => {
                                                const question = questionMap.get(answer.questionId);
                                                const questionType = question?.type || 'mcq';

                                                let responseText = String(answer.response ?? '');
                                                if (questionType === 'mcq' && typeof answer.response === 'number' && question?.options) {
                                                    responseText = question.options[answer.response] || `Option ${answer.response + 1}`;
                                                }

                                                return (
                                                    <div key={idx} className="border border-slate-600 rounded-lg p-3 bg-slate-800/60">
                                                        <p className="text-white text-sm mb-1">{question?.question || 'Question'}</p>
                                                        <p className="text-slate-300 text-sm">Answer: {responseText || 'No answer'}</p>
                                                        <p className={`text-xs mt-1 ${answer.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                            {answer.isCorrect ? 'Correct' : 'Incorrect'} ({answer.points} pts)
                                                        </p>

                                                        {questionType !== 'mcq' && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <button
                                                                    onClick={() => updateRegradeAnswer(idx, question, true)}
                                                                    className={`px-3 py-1 rounded-md text-xs border ${
                                                                        answer.isCorrect
                                                                            ? 'bg-emerald-900/50 text-emerald-200 border-emerald-500/70'
                                                                            : 'bg-slate-700 text-slate-300 border-slate-500 hover:bg-slate-600'
                                                                    }`}
                                                                >
                                                                    Mark Correct
                                                                </button>
                                                                <button
                                                                    onClick={() => updateRegradeAnswer(idx, question, false)}
                                                                    className={`px-3 py-1 rounded-md text-xs border ${
                                                                        !answer.isCorrect
                                                                            ? 'bg-red-900/50 text-red-200 border-red-500/70'
                                                                            : 'bg-slate-700 text-slate-300 border-slate-500 hover:bg-slate-600'
                                                                    }`}
                                                                >
                                                                    Mark Incorrect
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="border-t border-slate-600 pt-4 space-y-3">
                                            <p className="text-sm text-slate-300">
                                                Manual regrade for text/diagram answers
                                            </p>
                                            <button
                                                onClick={saveSubmissionRegrade}
                                                disabled={savingScore}
                                                className="btn-secondary disabled:opacity-50"
                                            >
                                                {savingScore ? 'Saving...' : 'Save Regrade'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                <p className="text-slate-400 text-sm mb-1">Submissions</p>
                                <p className="text-3xl font-bold text-white">{stats.total}</p>
                            </div>
                            <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                <p className="text-slate-400 text-sm mb-1">Average</p>
                                <p className="text-3xl font-bold text-indigo-400">{stats.average}%</p>
                            </div>
                            <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                <p className="text-slate-400 text-sm mb-1">Highest</p>
                                <p className="text-3xl font-bold text-green-400">{stats.highest}%</p>
                            </div>
                            <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-4">
                                <p className="text-slate-400 text-sm mb-1">Lowest</p>
                                <p className="text-3xl font-bold text-red-400">{stats.lowest}%</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'questions' && (
                <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900/95 border-t border-slate-700 backdrop-blur-sm">
                    <div className="max-w-6xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-slate-300 text-sm">
                            Editing: <span className="text-white font-semibold">{draftQuestions.length}</span> {draftQuestions.length === 1 ? 'question' : 'questions'}
                        </p>
                        <button
                            onClick={saveQuizChanges}
                            disabled={savingQuiz || !hasUnsavedChanges}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {savingQuiz ? 'Saving...' : 'Save Quiz Changes'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
