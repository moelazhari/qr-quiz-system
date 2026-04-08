'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Answer, DiagramModel, Question, Quiz, Submission } from '@/types';
import DiagramBuilder from '@/components/DiagramBuilder';
import { createEmptyDiagram, normalizeDiagram, validateMeriseDiagram } from '@/lib/diagram';

type TabKey = 'overview' | 'questions' | 'submissions';

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

export default function TeacherQuizDetailsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftResultsReleaseMode, setDraftResultsReleaseMode] = useState<'immediate' | 'after_review'>('immediate');
    const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingQuiz, setSavingQuiz] = useState(false);
    const [savingScore, setSavingScore] = useState(false);
    const [deletingQuiz, setDeletingQuiz] = useState(false);
    const [deletingSubmission, setDeletingSubmission] = useState(false);
    const [togglingQuizStatus, setTogglingQuizStatus] = useState(false);
    const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
    const [gradingAnswers, setGradingAnswers] = useState<Answer[]>([]);
    const [showPendingOnly, setShowPendingOnly] = useState(true);
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
            setDraftResultsReleaseMode((quizData.results_release_mode as 'immediate' | 'after_review') || 'immediate');
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
        const sameReleaseMode = draftResultsReleaseMode === (quiz.results_release_mode || 'immediate');
        const sameQuestions = JSON.stringify(sanitizeQuestions(draftQuestions)) === JSON.stringify(sanitizeQuestions(quiz.questions));
        return !(sameTitle && sameDescription && sameReleaseMode && sameQuestions);
    }, [quiz, draftTitle, draftDescription, draftResultsReleaseMode, draftQuestions]);

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
            gradingMode: 'auto',
            question: '',
            questionImageUrl: '',
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
        const questionId = draftQuestions[index]?.id;
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
                    results_release_mode: draftResultsReleaseMode,
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

    const updateRegradeAnswerPoints = (index: number, question: Question | undefined, value: number) => {
        const maxPoints = Number(question?.points) || 0;
        const clamped = Math.max(0, Math.min(maxPoints, value));
        setGradingAnswers((prev) =>
            prev.map((answer, i) =>
                i === index
                    ? {
                        ...answer,
                        points: clamped,
                        isCorrect: clamped > 0,
                        reviewed: true,
                    }
                    : answer
            )
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

    const finalizeSubmissionReview = async () => {
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
                body: JSON.stringify({ answers: gradingAnswers, finalizeReview: true }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to finalize review');
            }

            setToast({ type: 'success', message: 'Submission reviewed and released.' });
            await fetchData();
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to finalize review' });
        } finally {
            setSavingScore(false);
        }
    };

    const deleteSelectedSubmission = async () => {
        if (!selectedSubmission) {
            setToast({ type: 'error', message: 'Select a submission first.' });
            return;
        }
        if (!confirm('Delete this submission? The student will be able to submit the quiz again.')) return;

        setDeletingSubmission(true);
        setToast(null);

        try {
            const response = await fetch(`/api/submissions/${selectedSubmission.id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete submission');
            }

            setSelectedSubmission(null);
            setGradingAnswers([]);
            setToast({ type: 'success', message: 'Submission deleted. Student can now resubmit.' });
            await fetchData();
        } catch (err: any) {
            setToast({ type: 'error', message: err.message || 'Failed to delete submission' });
        } finally {
            setDeletingSubmission(false);
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

    const pendingSubmissionsCount = useMemo(
        () => submissions.filter((submission) => submission.status === 'pending_review').length,
        [submissions]
    );

    const visibleSubmissions = useMemo(
        () => (showPendingOnly ? submissions.filter((submission) => submission.status === 'pending_review') : submissions),
        [submissions, showPendingOnly]
    );

    const canFinalizeSelectedSubmission = useMemo(() => {
        if (!selectedSubmission) return false;
        const hasUnreviewedManual = gradingAnswers.some((answer) => {
            const question = questionMap.get(String(answer.questionId));
            const questionType = question?.type || 'mcq';
            const gradingMode = question?.gradingMode || (questionType === 'mcq' ? 'auto' : 'manual');
            return gradingMode === 'manual' && !answer.reviewed;
        });
        return !hasUnreviewedManual;
    }, [selectedSubmission, gradingAnswers, questionMap]);

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
                <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/90 via-slate-800 to-slate-900 p-6 shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm">← Back to Dashboard</Link>
                            <h1 className="text-3xl font-bold text-white mt-2">Manage Quiz</h1>
                            <p className="text-slate-300 font-medium">{quiz.title}</p>
                            <p className="text-slate-500 text-sm mt-1">{quiz.description || 'No description added yet.'}</p>
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

                <div className="card border-slate-700/80">
                    <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4 mb-6">
                        {(['overview', 'questions', 'submissions'] as TabKey[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    activeTab === tab
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {{
                                    overview: 'Overview',
                                    questions: 'Edit Quiz',
                                    submissions: 'Submissions',
                                }[tab]}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4">
                                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Questions</p>
                                    <p className="text-3xl font-bold text-white">{quiz.questions.length}</p>
                                </div>
                                <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4">
                                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Submissions</p>
                                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                                </div>
                                <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4">
                                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Average Score</p>
                                    <p className="text-3xl font-bold text-indigo-300">{stats.average}%</p>
                                </div>
                                <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4">
                                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Pending Review</p>
                                    <p className="text-3xl font-bold text-amber-300">{pendingSubmissionsCount}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-slate-700/30 border border-slate-600 rounded-xl p-5">
                                    <h3 className="text-white font-semibold text-lg mb-4">Performance Snapshot</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4">
                                            <p className="text-slate-400 text-sm mb-1">Highest</p>
                                            <p className="text-2xl font-bold text-green-300">{stats.highest}%</p>
                                        </div>
                                        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4">
                                            <p className="text-slate-400 text-sm mb-1">Lowest</p>
                                            <p className="text-2xl font-bold text-red-300">{stats.lowest}%</p>
                                        </div>
                                        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4">
                                            <p className="text-slate-400 text-sm mb-1">Release Mode</p>
                                            <p className="text-lg font-semibold text-white">{quiz.results_release_mode === 'after_review' ? 'After Review' : 'Immediate'}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                                        <p className="text-slate-400 text-sm mb-1">Description</p>
                                        <p className="text-slate-200">{quiz.description || 'No description provided.'}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-5">
                                    <h3 className="text-white font-semibold text-lg mb-4">Quiz QR</h3>
                                    {quiz.qr_code ? (
                                        <img src={quiz.qr_code} alt={`QR for ${quiz.title}`} className="w-full max-w-[240px] mx-auto rounded-lg bg-white p-2" />
                                    ) : (
                                        <p className="text-slate-400">QR code unavailable</p>
                                    )}
                                </div>
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
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Release Grades</label>
                                    <select
                                        value={draftResultsReleaseMode}
                                        onChange={(e) => setDraftResultsReleaseMode(e.target.value as 'immediate' | 'after_review')}
                                        className="input-field max-w-md"
                                    >
                                        <option value="immediate">Immediately after submission</option>
                                        <option value="after_review">After teacher review</option>
                                    </select>
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
                                                    Students will recreate this model from draggable shapes. Auto-grading compares labels, attributes, links, and cardinalities, and you can still review the final score in submissions.
                                                </div>
                                                <DiagramBuilder
                                                    value={q.diagramTemplate || createEmptyDiagram()}
                                                    onChange={(diagramTemplate) => updateQuestion(index, { diagramTemplate })}
                                                    title="Expected Diagram"
                                                    description="Use the builder to define the reference model for this question."
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
                    )}

                    {activeTab === 'submissions' && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-slate-300 text-sm">
                                            Grading Inbox
                                        </p>
                                        <button
                                            onClick={() => setShowPendingOnly((prev) => !prev)}
                                            className="px-3 py-2 text-xs rounded-lg border border-slate-500 bg-slate-700 hover:bg-slate-600 text-slate-200"
                                        >
                                            {showPendingOnly ? 'Show All' : 'Show Pending Only'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Pending review: <span className="text-white font-semibold">{pendingSubmissionsCount}</span>
                                    </p>
                                </div>

                                {visibleSubmissions.length === 0 ? (
                                    <div className="bg-slate-700/20 border border-slate-600 rounded-lg p-6 text-center text-slate-400">
                                        No submissions found for this filter.
                                    </div>
                                ) : (
                                    visibleSubmissions.map((submission) => {
                                        const pct = Math.round((submission.score / submission.total_points) * 100);
                                        const isSelected = selectedSubmission?.id === submission.id;
                                        return (
                                            <button
                                                key={submission.id}
                                                onClick={() => openSubmissionDetails(submission.id!)}
                                                className={`w-full text-left border rounded-xl p-4 transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-900/30 border-indigo-500 shadow-lg shadow-indigo-900/20'
                                                        : 'bg-slate-700/40 border-slate-600 hover:bg-slate-700'
                                                }`}
                                            >
                                                <p className="text-white font-semibold">{submission.student_name}</p>
                                                <p className="text-slate-400 text-sm">{submission.student_email}</p>
                                                <div className="flex items-center justify-between mt-3">
                                                    <p className="text-slate-300 text-sm">Score: {submission.score}/{submission.total_points} ({pct}%)</p>
                                                    <span className={`text-xs px-2 py-1 rounded border ${
                                                        submission.status === 'pending_review'
                                                            ? 'text-amber-200 bg-amber-900/40 border-amber-500/60'
                                                            : 'text-emerald-200 bg-emerald-900/40 border-emerald-500/60'
                                                    }`}>
                                                        {submission.status === 'pending_review' ? 'Pending' : 'Graded'}
                                                    </span>
                                                </div>
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
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded border ${
                                                    selectedSubmission.status === 'pending_review'
                                                        ? 'text-amber-200 bg-amber-900/40 border-amber-500/60'
                                                        : 'text-emerald-200 bg-emerald-900/40 border-emerald-500/60'
                                                }`}>
                                                    {selectedSubmission.status === 'pending_review' ? 'Pending Review' : 'Reviewed'}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded border ${
                                                    selectedSubmission.is_released === false
                                                        ? 'text-orange-200 bg-orange-900/40 border-orange-500/60'
                                                        : 'text-blue-200 bg-blue-900/40 border-blue-500/60'
                                                }`}>
                                                    {selectedSubmission.is_released === false ? 'Not Released' : 'Released'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {gradingAnswers.map((answer, idx) => {
                                                const question = questionMap.get(answer.questionId);
                                                const questionType = question?.type || 'mcq';
                                                const gradingMode = question?.gradingMode || (questionType === 'mcq' ? 'auto' : 'manual');
                                                const canOverrideScore = gradingMode === 'manual' || questionType === 'diagram';

                                                let responseText = String(answer.response ?? '');
                                                if (questionType === 'mcq' && typeof answer.response === 'number' && question?.options) {
                                                    responseText = question.options[answer.response] || `Option ${answer.response + 1}`;
                                                }
                                                if (questionType === 'diagram') {
                                                    responseText = '';
                                                }

                                                return (
                                                    <div key={idx} className="border border-slate-600 rounded-lg p-3 bg-slate-800/60">
                                                        <p className="text-white text-sm mb-1">{question?.question || 'Question'}</p>
                                                        {responseText ? (
                                                            <p className="text-slate-300 text-sm">Answer: {responseText}</p>
                                                        ) : (
                                                            <p className="text-slate-500 text-sm">{questionType === 'diagram' ? 'Diagram answer' : 'No answer'}</p>
                                                        )}
                                                        <p className={`text-xs mt-1 ${answer.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                            {answer.isCorrect ? 'Correct' : 'Incorrect'} ({answer.points} pts)
                                                        </p>

                                                        {questionType === 'diagram' && typeof answer.response === 'object' && answer.response && (
                                                            <div className="mt-4 space-y-3">
                                                                <div className="rounded-xl border border-slate-600 bg-slate-900/40 p-3">
                                                                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Student Diagram</p>
                                                                    <DiagramBuilder
                                                                        value={answer.response as DiagramModel}
                                                                        readOnly
                                                                        mode="viewer"
                                                                    />
                                                                </div>
                                                                {question?.diagramTemplate && (
                                                                    <div className="rounded-xl border border-slate-600 bg-slate-900/40 p-3">
                                                                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Expected Diagram</p>
                                                                        <DiagramBuilder
                                                                            value={question.diagramTemplate}
                                                                            readOnly
                                                                            mode="viewer"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="rounded-xl border border-slate-600 bg-slate-900/40 p-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Action Log</p>
                                                                        <span className="rounded-full border border-slate-500 px-2 py-1 text-[11px] text-slate-300">
                                                                            {Array.isArray((answer.response as DiagramModel).actionLog) ? (answer.response as DiagramModel).actionLog!.length : 0} events
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                                                                        {Array.isArray((answer.response as DiagramModel).actionLog) && (answer.response as DiagramModel).actionLog!.length > 0 ? (
                                                                            (answer.response as DiagramModel).actionLog!.slice().reverse().map((event) => (
                                                                                <div key={event.id} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                                                                                    <div className="flex items-center justify-between gap-3">
                                                                                        <p className="text-sm font-medium text-white">{event.summary}</p>
                                                                                        <span className="text-[11px] text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                                                                    </div>
                                                                                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">{event.type}</p>
                                                                                    <div className="mt-2 space-y-1">
                                                                                        {event.vectors.map((vector, vectorIndex) => (
                                                                                            <p key={`${event.id}-${vectorIndex}`} className="text-xs text-slate-300">
                                                                                                {vector.subjectType}: <span className="mono text-slate-100">{vector.vector}</span>
                                                                                            </p>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <p className="text-sm text-slate-500">No logged diagram events.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {Array.isArray(answer.feedback) && answer.feedback.length > 0 && (
                                                            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                                                                <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Auto-detected issues</p>
                                                                <div className="mt-2 space-y-1">
                                                                    {answer.feedback.map((item, feedbackIndex) => (
                                                                        <p key={`${answer.questionId}-feedback-${feedbackIndex}`} className="text-xs text-amber-100">
                                                                            {item}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {canOverrideScore && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <div className="flex items-center gap-2 mr-3">
                                                                    <label className="text-xs text-slate-400">Points</label>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={question?.points || 0}
                                                                        value={answer.points}
                                                                        onChange={(e) => updateRegradeAnswerPoints(idx, question, Number(e.target.value) || 0)}
                                                                        className="input-field w-24 py-2"
                                                                    />
                                                                    <span className="text-xs text-slate-500">/ {question?.points || 0}</span>
                                                                </div>
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
                                            <p className="text-sm text-slate-300">Teacher Actions</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={saveSubmissionRegrade}
                                                    disabled={savingScore}
                                                    className="btn-secondary disabled:opacity-50"
                                                >
                                                    {savingScore ? 'Saving...' : 'Save Regrade'}
                                                </button>
                                                <button
                                                    onClick={finalizeSubmissionReview}
                                                    disabled={savingScore || !canFinalizeSelectedSubmission}
                                                    className="px-4 py-3 rounded-lg text-sm font-semibold border bg-emerald-900/40 text-emerald-200 border-emerald-500/70 hover:bg-emerald-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {savingScore ? 'Processing...' : 'Finalize & Release'}
                                                </button>
                                                <button
                                                    onClick={deleteSelectedSubmission}
                                                    disabled={deletingSubmission}
                                                    className="px-4 py-3 rounded-lg text-sm font-semibold border bg-red-900/40 text-red-200 border-red-500/70 hover:bg-red-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {deletingSubmission ? 'Deleting...' : 'Delete Submission'}
                                                </button>
                                            </div>
                                            {!canFinalizeSelectedSubmission && (
                                                <p className="text-xs text-amber-300">
                                                    Review all manual questions before finalizing.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
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
