/**
 * Sample Data Seed Script for PostgreSQL (Supabase)
 *
 * Run with:
 *   node scripts/seed.js
 */

require('dotenv').config({ path: '.env.local' });

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is not set in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // required for Supabase
    },
});

async function seed() {
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        /* =========================
           CREATE TABLES
        ========================= */

        console.log('📦 Creating tables...');

        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'student')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        teacher_name VARCHAR(255) NOT NULL,
        questions JSONB NOT NULL,
        qr_code TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        quiz_title VARCHAR(500) NOT NULL,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_name VARCHAR(255) NOT NULL,
        student_email VARCHAR(255) NOT NULL,
        answers JSONB NOT NULL,
        score INTEGER NOT NULL,
        total_points INTEGER NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (quiz_id, student_id)
      );
    `);

        /* =========================
           CLEAR OLD DATA
        ========================= */

        console.log('🧹 Clearing old data...');

        await client.query('DELETE FROM submissions');
        await client.query('DELETE FROM quizzes');
        await client.query('DELETE FROM users');

        await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE quizzes_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE submissions_id_seq RESTART WITH 1');

        /* =========================
           INSERT USERS
        ========================= */

        console.log('👤 Creating sample users...');

        const hashedPassword = await bcrypt.hash('password123', 10);

        const teacherRes = await client.query(
            `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, 'teacher')
      RETURNING id;
      `,
            ['John Teacher', 'teacher@example.com', hashedPassword]
        );

        const teacherId = teacherRes.rows[0].id;

        await client.query(
            `
      INSERT INTO users (name, email, password, role)
      VALUES
        ($1, $2, $3, 'student'),
        ($4, $5, $6, 'student');
      `,
            [
                'Alice Student',
                'alice@example.com',
                hashedPassword,
                'Bob Student',
                'bob@example.com',
                hashedPassword,
            ]
        );

        console.log('✅ Users created');
        console.log('Teacher: teacher@example.com / password123');
        console.log('Student: alice@example.com / password123');
        console.log('Student: bob@example.com / password123');

        /* =========================
           INSERT QUIZ
        ========================= */

        console.log('📝 Creating sample quiz...');

        const questions = [
            {
                id: '1',
                question: 'What is the correct way to declare a variable in JavaScript?',
                options: [
                    'var myVar = 10;',
                    'variable myVar = 10;',
                    'v myVar = 10;',
                    'dim myVar = 10;',
                ],
                correctAnswer: 0,
                points: 10,
            },
            {
                id: '2',
                question: 'Which method is used to add an element to the end of an array?',
                options: ['append()', 'push()', 'add()', 'insert()'],
                correctAnswer: 1,
                points: 10,
            },
            {
                id: '3',
                question: 'What does === operator do in JavaScript?',
                options: [
                    'Checks value only',
                    'Checks type only',
                    'Checks value and type',
                    'Assigns a value',
                ],
                correctAnswer: 2,
                points: 10,
            },
            {
                id: '4',
                question: 'Which is NOT a JavaScript data type?',
                options: ['String', 'Boolean', 'Float', 'Object'],
                correctAnswer: 2,
                points: 10,
            },
            {
                id: '5',
                question: 'What is typeof null?',
                options: ['"null"', '"object"', '"undefined"', '"number"'],
                correctAnswer: 1,
                points: 10,
            },
        ];

        await client.query(
            `
      INSERT INTO quizzes (
        title,
        description,
        teacher_id,
        teacher_name,
        questions,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, true);
      `,
            [
                'JavaScript Basics Quiz',
                'Test your knowledge of JavaScript fundamentals',
                teacherId,
                'John Teacher',
                JSON.stringify(questions),
            ]
        );

        console.log('✅ Sample quiz created');

        console.log('\n🎉 SEED COMPLETED SUCCESSFULLY');
        console.log('You can now log in and test the system.');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await client.end();
        console.log('🔌 Disconnected from PostgreSQL');
    }
}

seed();