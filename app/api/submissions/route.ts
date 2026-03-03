import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pool, ensureDbInitialized } from '@/lib/db';
import { Submission, Quiz, Answer } from '@/types';

// Helper to run queries safely
async function runQuery<T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> {
    const client = await pool.connect();
    try {
        const res = await client.query<any>(query, params);
        return res;
    } finally {
        client.release();
    }
}

// GET - Fetch submissions
export async function GET(request: NextRequest) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const quizId = searchParams.get('quizId');
        const userId = parseInt((session.user as any).id);
        const role = (session.user as any).role;

        if (role === 'student') {
            // Fetch student's submissions
            const query = quizId
                ? 'SELECT * FROM submissions WHERE student_id = $1 AND quiz_id = $2 ORDER BY submitted_at DESC'
                : 'SELECT * FROM submissions WHERE student_id = $1 ORDER BY submitted_at DESC';

            const params = quizId ? [userId, parseInt(quizId)] : [userId];
            const result = await runQuery<Submission>(query, params);

            return NextResponse.json(result.rows);
        }

        if (role === 'teacher' && quizId) {
            // Ensure teacher owns the quiz before exposing submissions
            const quizCheck = await runQuery<{ id: number }>(
                'SELECT id FROM quizzes WHERE id = $1 AND teacher_id = $2',
                [parseInt(quizId), userId]
            );

            if (quizCheck.rows.length === 0) {
                return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
            }

            // Fetch all submissions for a specific quiz
            const result = await runQuery<Submission>(
                'SELECT * FROM submissions WHERE quiz_id = $1 ORDER BY submitted_at DESC',
                [parseInt(quizId)]
            );
            return NextResponse.json(result.rows);
        }

        return NextResponse.json([]);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }
}

// POST - Submit quiz answers
export async function POST(request: NextRequest) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quizId, answers } = await request.json();
        const studentId = parseInt((session.user as any).id);

        // Fetch the quiz
        const quizResult = await runQuery<Quiz>('SELECT * FROM quizzes WHERE id = $1', [parseInt(quizId)]);
        if (quizResult.rows.length === 0) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const quiz = quizResult.rows[0];

        if (!quiz.is_active) {
            return NextResponse.json({ error: 'Quiz is not active' }, { status: 400 });
        }

        // Check if student already submitted
        const existing = await runQuery<Submission>(
            'SELECT * FROM submissions WHERE quiz_id = $1 AND student_id = $2',
            [parseInt(quizId), studentId]
        );
        if (existing.rows.length > 0) {
            return NextResponse.json({ error: 'You have already submitted this quiz' }, { status: 400 });
        }

        // Calculate score
        let totalScore = 0;
        let totalPoints = 0;
        const processedAnswers: Answer[] = [];

        quiz.questions.forEach((question: any) => {
            const questionType = question.type || 'mcq';
            const studentAnswer = answers[question.id];
            let isCorrect = false;

            if (questionType === 'mcq') {
                isCorrect = studentAnswer === question.correctAnswer;
            } else {
                const normalizedStudentAnswer = String(studentAnswer ?? '').trim().toLowerCase();
                const normalizedCorrectAnswer = String(question.correctTextAnswer ?? '').trim().toLowerCase();
                isCorrect = normalizedStudentAnswer.length > 0 && normalizedStudentAnswer === normalizedCorrectAnswer;
            }

            totalPoints += question.points;
            if (isCorrect) totalScore += question.points;

            processedAnswers.push({
                questionId: question.id,
                response: studentAnswer ?? '',
                isCorrect,
                points: isCorrect ? question.points : 0
            });
        });

        // Insert submission
        await runQuery(
            `INSERT INTO submissions (
        quiz_id, quiz_title, student_id, student_name, student_email,
        answers, score, total_points
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
            [
                parseInt(quizId),
                quiz.title,
                studentId,
                session.user.name || '',
                session.user.email || '',
                JSON.stringify(processedAnswers),
                totalScore,
                totalPoints
            ]
        );

        return NextResponse.json({
            message: 'Quiz submitted successfully',
            score: totalScore,
            totalPoints,
            percentage: (totalScore / totalPoints) * 100
        }, { status: 201 });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
    }
}
