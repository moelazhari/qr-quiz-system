import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pool, ensureDbInitialized } from '@/lib/db';
import { Quiz } from '@/types';
import QRCode from 'qrcode';

async function runQuery<T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> {
    const client = await pool.connect();
    try {
        const res = await client.query<any>(query, params);
        return res;
    } finally {
        client.release();
    }
}

export async function GET(request: NextRequest) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const quizId = searchParams.get('id');
        const userId = parseInt((session.user as any).id);

        if (quizId) {
            // Fetch specific quiz
            const result = await runQuery<Quiz>(
                'SELECT * FROM quizzes WHERE id = $1',
                [parseInt(quizId)]
            );

            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
            }

            return NextResponse.json(result.rows[0]);
        }

        // Fetch all quizzes for teacher
        if ((session.user as any).role === 'teacher') {
            const result = await runQuery<Quiz>(
                'SELECT * FROM quizzes WHERE teacher_id = $1 ORDER BY created_at DESC',
                [userId]
            );
            return NextResponse.json(result.rows);
        }

        return NextResponse.json([]);
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
    }
}

// POST - Create new quiz
export async function POST(request: NextRequest) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const quizData = await request.json();
        const teacherId = parseInt((session.user as any).id);

        // Insert quiz
        const insertResult = await runQuery<{ id: number }>(
            `INSERT INTO quizzes (title, description, teacher_id, teacher_name, questions, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, true) RETURNING id`,
            [
                quizData.title,
                quizData.description,
                teacherId,
                session.user.name || '',
                JSON.stringify(quizData.questions),
            ]
        );

        const quizId = insertResult.rows[0].id;

        // Generate QR Code
        const quizUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quiz/${quizId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(quizUrl, { width: 300, margin: 2 });

        // Update quiz with QR code
        await runQuery('UPDATE quizzes SET qr_code = $1 WHERE id = $2', [qrCodeDataUrl, quizId]);

        return NextResponse.json(
            { message: 'Quiz created successfully', quizId, qrCode: qrCodeDataUrl },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating quiz:', error);
        return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 });
    }
}

// PUT - Update quiz
export async function PUT(request: NextRequest) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, is_active, title, description, questions } = await request.json();
        const teacherId = parseInt((session.user as any).id);

        // Build dynamic query
        const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
        const values: any[] = [];

        if (is_active !== undefined) {
            values.push(is_active);
            fields.push(`is_active = $${values.length}`);
        }
        if (title !== undefined) {
            values.push(title);
            fields.push(`title = $${values.length}`);
        }
        if (description !== undefined) {
            values.push(description);
            fields.push(`description = $${values.length}`);
        }
        if (questions !== undefined) {
            values.push(JSON.stringify(questions));
            fields.push(`questions = $${values.length}::jsonb`);
        }

        values.push(parseInt(id));
        values.push(teacherId);

        const query = `
      UPDATE quizzes
      SET ${fields.join(', ')}
      WHERE id = $${values.length - 1} AND teacher_id = $${values.length}
      RETURNING id
    `;

        const result = await runQuery<{ id: number }>(query, values);

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Quiz updated successfully' });
    } catch (error) {
        console.error('Error updating quiz:', error);
        return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
    }
}

// DELETE - Delete quiz
export async function DELETE(request: NextRequest) {
    try {
        await ensureDbInitialized();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const quizId = searchParams.get('id');

        if (!quizId) {
            return NextResponse.json({ error: 'Quiz ID required' }, { status: 400 });
        }

        const teacherId = parseInt((session.user as any).id);

        const result = await runQuery<{ id: number }>(
            'DELETE FROM quizzes WHERE id = $1 AND teacher_id = $2 RETURNING id',
            [parseInt(quizId), teacherId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error('Error deleting quiz:', error);
        return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
    }
}
