import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureDbInitialized } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { User } from '@/types';

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

export async function POST(request: NextRequest) {
    try {
        await ensureDbInitialized();

        const { name, email, password, role } = await request.json();

        // Validation
        if (!name || !email || !password || !role) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (!['teacher', 'student'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await runQuery<User>(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await runQuery<User>(
            'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id',
            [name, email, hashedPassword, role]
        );

        return NextResponse.json(
            {
                message: 'User registered successfully',
                userId: result.rows[0].id
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
    }
}
