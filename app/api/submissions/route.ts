import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pool, ensureDbInitialized } from '@/lib/db';
import { Submission, Quiz, Answer } from '@/types';
import { gradeDiagramAnswer, normalizeDiagram } from '@/lib/diagram';

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

function normalizeText(value: string) {
    return value.trim().toLowerCase();
}

function evaluateTextAnswer(question: any, studentAnswerRaw: any) {
    const studentAnswer = normalizeText(String(studentAnswerRaw ?? ''));
    if (!studentAnswer) return false;

    const acceptedAnswers = Array.isArray(question.acceptedTextAnswers)
        ? question.acceptedTextAnswers.map((item: string) => normalizeText(String(item)))
        : [];
    const fallbackSingle = normalizeText(String(question.correctTextAnswer ?? ''));
    const candidateAnswers = acceptedAnswers.length > 0 ? acceptedAnswers : [fallbackSingle];
    const exactMatch = candidateAnswers.some((candidate: string) => candidate && candidate === studentAnswer);

    if (exactMatch) return true;

    const keywords = Array.isArray(question.requiredKeywords)
        ? question.requiredKeywords.map((item: string) => normalizeText(String(item))).filter(Boolean)
        : [];

    if (keywords.length > 0) {
        return keywords.every((keyword: string) => studentAnswer.includes(keyword));
    }

    return false;
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

            const safeRows = result.rows.map((submission: any) => {
                const normalized = {
                    ...submission,
                    status: submission.status || 'graded',
                    is_released: submission.is_released !== false,
                };
                if (normalized.is_released) return normalized;

                return {
                    ...normalized,
                    score: 0,
                };
            });

            return NextResponse.json(safeRows);
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
            const normalizedRows = result.rows.map((submission: any) => ({
                ...submission,
                status: submission.status || 'graded',
                is_released: submission.is_released !== false,
            }));
            return NextResponse.json(normalizedRows);
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

        let hasManualReviewQuestions = false;

        quiz.questions.forEach((question: any) => {
            const questionType = question.type || 'mcq';
            const gradingMode = question.gradingMode || (questionType === 'mcq' ? 'auto' : 'manual');
            const studentAnswer = answers[question.id];
            let isCorrect = false;
            let reviewed = gradingMode === 'auto';
            let awardedPoints = 0;
            let feedback: string[] | undefined;
            let autoGradeDetails: Answer['autoGradeDetails'] | undefined;

            if (gradingMode === 'manual') {
                hasManualReviewQuestions = true;
                isCorrect = false;
                awardedPoints = 0;
                reviewed = false;
            } else if (questionType === 'mcq') {
                isCorrect = studentAnswer === question.correctAnswer;
                awardedPoints = isCorrect ? Number(question.points) : 0;
            } else if (questionType === 'diagram') {
                const result = gradeDiagramAnswer(question.diagramTemplate, normalizeDiagram(studentAnswer));
                const isPerfectMatch =
                    result.details.missingNodes.length === 0 &&
                    result.details.extraNodes.length === 0 &&
                    result.details.missingAttributes.length === 0 &&
                    result.details.extraAttributes.length === 0 &&
                    result.details.missingLinks.length === 0 &&
                    result.details.extraLinks.length === 0 &&
                    result.details.cardinalityMismatches.length === 0;
                awardedPoints = isPerfectMatch ? Number(question.points) : 0;
                isCorrect = isPerfectMatch;
                feedback = [isPerfectMatch ? 'Exact diagram match.' : 'Diagram does not exactly match the teacher reference.', ...result.feedback];
                autoGradeDetails = result.details;
            } else {
                isCorrect = evaluateTextAnswer(question, studentAnswer);
                awardedPoints = isCorrect ? Number(question.points) : 0;
            }

            totalPoints += Number(question.points);
            totalScore += Number(awardedPoints);

            processedAnswers.push({
                questionId: question.id,
                response: studentAnswer ?? '',
                isCorrect,
                points: awardedPoints,
                reviewed,
                feedback,
                autoGradeDetails,
            });
        });

        const releaseMode = quiz.results_release_mode || 'immediate';
        const status =
            releaseMode === 'after_review'
                ? 'pending_review'
                : hasManualReviewQuestions
                    ? 'pending_review'
                    : 'graded';
        const isReleased = releaseMode === 'immediate' && status === 'graded';

        // Insert submission
        await runQuery(
            `INSERT INTO submissions (
        quiz_id, quiz_title, student_id, student_name, student_email,
        answers, score, total_points, status, is_released
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
            [
                parseInt(quizId),
                quiz.title,
                studentId,
                session.user.name || '',
                session.user.email || '',
                JSON.stringify(processedAnswers),
                totalScore,
                totalPoints,
                status,
                isReleased,
            ]
        );

        if (!isReleased) {
            return NextResponse.json({
                message: 'Quiz submitted successfully and is pending teacher review',
                status,
                scoreReleased: false,
            }, { status: 201 });
        }

        return NextResponse.json({
            message: 'Quiz submitted successfully',
            status,
            scoreReleased: true,
            score: totalScore,
            totalPoints,
            percentage: (totalScore / totalPoints) * 100
        }, { status: 201 });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
    }
}
