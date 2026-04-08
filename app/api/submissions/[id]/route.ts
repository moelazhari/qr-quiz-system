import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pool, ensureDbInitialized } from '@/lib/db';
import { Answer, Question, Submission } from '@/types';

async function runQuery<T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> {
    const client = await pool.connect();
    try {
        const res = await client.query<any>(query, params);
        return res;
    } finally {
        client.release();
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const teacherId = parseInt((session.user as any).id);

        const result = await runQuery<Submission>(
            `SELECT s.*
             FROM submissions s
             INNER JOIN quizzes q ON q.id = s.quiz_id
             WHERE s.id = $1 AND q.teacher_id = $2`,
            [parseInt(id), teacherId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        return NextResponse.json({
            ...result.rows[0],
            status: (result.rows[0] as any).status || 'graded',
            is_released: (result.rows[0] as any).is_released !== false,
        });
    } catch (error) {
        console.error('Error fetching submission:', error);
        return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { score, answers, finalizeReview } = body;
        const { id } = await params;
        const teacherId = parseInt((session.user as any).id);

        const current = await runQuery<Submission & { total_points: number; questions: Question[]; results_release_mode: string }>(
            `SELECT s.*, q.questions, q.results_release_mode
             FROM submissions s
             INNER JOIN quizzes q ON q.id = s.quiz_id
             WHERE s.id = $1 AND q.teacher_id = $2`,
            [parseInt(id), teacherId]
        );

        if (current.rows.length === 0) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        const submission = current.rows[0];

        if (Array.isArray(answers)) {
            const questionMap = new Map<string, Question>();
            (submission.questions || []).forEach((question) => questionMap.set(question.id, question));
            const currentAnswers = Array.isArray(submission.answers) ? submission.answers : [];
            const incomingByQuestion = new Map<string, any>();
            answers.forEach((answer: any) => incomingByQuestion.set(String(answer.questionId), answer));

            const regradedAnswers: Answer[] = currentAnswers.map((existing: any) => {
                const questionId = String(existing.questionId);
                const question = questionMap.get(questionId);
                const questionType = question?.type || 'mcq';
                const gradingMode = question?.gradingMode || (questionType === 'mcq' ? 'auto' : 'manual');

                // Keep MCQ grading immutable; text/diagram answers may still need teacher override.
                if (questionType === 'mcq' && gradingMode === 'auto') {
                    return {
                        questionId,
                        response: existing.response ?? '',
                        isCorrect: Boolean(existing.isCorrect),
                        points: Number(existing.points) || 0,
                        reviewed: true,
                        feedback: Array.isArray((existing as any).feedback) ? (existing as any).feedback : undefined,
                        autoGradeDetails: (existing as any).autoGradeDetails,
                    };
                }

                const incoming = incomingByQuestion.get(questionId);
                if (!incoming) {
                    return {
                        questionId,
                        response: existing.response ?? '',
                        isCorrect: Boolean(existing.isCorrect),
                        points: Number(existing.points) || 0,
                        reviewed: Boolean(existing.reviewed),
                        feedback: Array.isArray((existing as any).feedback) ? (existing as any).feedback : undefined,
                        autoGradeDetails: (existing as any).autoGradeDetails,
                    };
                }

                const maxPoints = Number(question?.points) || 0;
                const requestedPoints = Number(incoming.points);
                const clampedPoints = Number.isFinite(requestedPoints)
                    ? Math.max(0, Math.min(maxPoints, requestedPoints))
                    : 0;

                return {
                    questionId,
                    response: existing.response ?? '',
                    isCorrect: clampedPoints > 0,
                    points: clampedPoints,
                    reviewed: true,
                    feedback: Array.isArray((existing as any).feedback) ? (existing as any).feedback : undefined,
                    autoGradeDetails: (existing as any).autoGradeDetails,
                };
            });

            const recalculatedScore = regradedAnswers.reduce((acc, answer) => acc + (Number(answer.points) || 0), 0);
            const hasUnreviewedManual = regradedAnswers.some((answer) => {
                const question = questionMap.get(String(answer.questionId));
                const questionType = question?.type || 'mcq';
                const gradingMode = question?.gradingMode || (questionType === 'mcq' ? 'auto' : 'manual');
                return gradingMode === 'manual' && !answer.reviewed;
            });
            const releaseMode = submission.results_release_mode || 'immediate';
            const shouldFinalize = Boolean(finalizeReview);

            if (shouldFinalize && hasUnreviewedManual) {
                return NextResponse.json({ error: 'Manual questions must be reviewed before finalizing' }, { status: 400 });
            }

            const status = shouldFinalize || (!hasUnreviewedManual && releaseMode === 'immediate')
                ? 'graded'
                : 'pending_review';
            const isReleased = releaseMode === 'immediate'
                ? status === 'graded'
                : shouldFinalize && status === 'graded';

            const updated = await runQuery<{ id: number; score: number; total_points: number; answers: Answer[]; status: string; is_released: boolean }>(
                'UPDATE submissions SET score = $1, answers = $2::jsonb, status = $3, is_released = $4 WHERE id = $5 RETURNING id, score, total_points, answers, status, is_released',
                [recalculatedScore, JSON.stringify(regradedAnswers), status, isReleased, parseInt(id)]
            );

            return NextResponse.json({
                message: 'Submission regraded successfully',
                submission: updated.rows[0],
                percentage: (updated.rows[0].score / updated.rows[0].total_points) * 100,
            });
        }

        if (finalizeReview === true) {
            const releaseMode = submission.results_release_mode || 'immediate';
            const updated = await runQuery<{ id: number; score: number; total_points: number; answers: Answer[]; status: string; is_released: boolean }>(
                'UPDATE submissions SET status = $1, is_released = $2 WHERE id = $3 RETURNING id, score, total_points, answers, status, is_released',
                ['graded', true, parseInt(id)]
            );

            return NextResponse.json({
                message: 'Submission finalized successfully',
                submission: updated.rows[0],
                percentage: (updated.rows[0].score / updated.rows[0].total_points) * 100,
            });
        }

        if (!Number.isInteger(score) || score < 0) {
            return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
        }

        if (score > submission.total_points) {
            return NextResponse.json({ error: 'Score cannot exceed total points' }, { status: 400 });
        }

        const updated = await runQuery<{ id: number; score: number; total_points: number; answers: Answer[] }>(
            'UPDATE submissions SET score = $1 WHERE id = $2 RETURNING id, score, total_points, answers',
            [score, parseInt(id)]
        );

        return NextResponse.json({
            message: 'Submission score updated successfully',
            submission: updated.rows[0],
            percentage: (updated.rows[0].score / updated.rows[0].total_points) * 100,
        });
    } catch (error) {
        console.error('Error updating submission:', error);
        return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const teacherId = parseInt((session.user as any).id);

        const deleted = await runQuery<{ id: number }>(
            `DELETE FROM submissions s
             USING quizzes q
             WHERE s.id = $1
               AND q.id = s.quiz_id
               AND q.teacher_id = $2
             RETURNING s.id`,
            [parseInt(id), teacherId]
        );

        if (deleted.rows.length === 0) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Submission deleted successfully' });
    } catch (error) {
        console.error('Error deleting submission:', error);
        return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
    }
}
