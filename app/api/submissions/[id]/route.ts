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

        return NextResponse.json(result.rows[0]);
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
        const { score, answers } = body;
        const { id } = await params;
        const teacherId = parseInt((session.user as any).id);

        const current = await runQuery<Submission & { total_points: number; questions: Question[] }>(
            `SELECT s.*, q.questions
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

                // Keep MCQ grading immutable to avoid accidental override.
                if (questionType === 'mcq') {
                    return {
                        questionId,
                        response: existing.response ?? '',
                        isCorrect: Boolean(existing.isCorrect),
                        points: Number(existing.points) || 0,
                    };
                }

                const incoming = incomingByQuestion.get(questionId);
                if (!incoming) {
                    return {
                        questionId,
                        response: existing.response ?? '',
                        isCorrect: Boolean(existing.isCorrect),
                        points: Number(existing.points) || 0,
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
                };
            });

            const recalculatedScore = regradedAnswers.reduce((acc, answer) => acc + (Number(answer.points) || 0), 0);

            const updated = await runQuery<{ id: number; score: number; total_points: number; answers: Answer[] }>(
                'UPDATE submissions SET score = $1, answers = $2::jsonb WHERE id = $3 RETURNING id, score, total_points, answers',
                [recalculatedScore, JSON.stringify(regradedAnswers), parseInt(id)]
            );

            return NextResponse.json({
                message: 'Submission regraded successfully',
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
