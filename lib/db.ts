import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // required for Supabase
    },
});

// Initialize database tables
export async function initDatabase() {
    try {
        const client = await pool.connect();

        // Users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'student')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Quizzes table
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
      )
    `);

        await client.query(`
      ALTER TABLE quizzes
      ADD COLUMN IF NOT EXISTS results_release_mode VARCHAR(30) DEFAULT 'immediate'
    `);

        // Submissions table
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
        UNIQUE(quiz_id, student_id)
      )
    `);

        await client.query(`
      ALTER TABLE submissions
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'graded'
    `);

        await client.query(`
      ALTER TABLE submissions
      ADD COLUMN IF NOT EXISTS is_released BOOLEAN DEFAULT true
    `);

        // Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_quizzes_teacher ON quizzes(teacher_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_quiz ON submissions(quiz_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id)`);

        client.release();
        console.log('Database tables created successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
}

// Singleton init
let dbInitialized = false;
export async function ensureDbInitialized() {
    if (!dbInitialized) {
        await initDatabase();
        dbInitialized = true;
    }
}

export { pool };
