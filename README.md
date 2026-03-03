# QR Quiz System (PostgreSQL Version)

A modern, role-based web application for creating and managing quizzes with QR code access. Built with Next.js 14, TypeScript, **PostgreSQL/Supabase (100% FREE)**, and Tailwind CSS.

![QR Quiz System](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Free-blue?style=for-the-badge&logo=postgresql)

## 🌟 Features

### For Teachers
- **Quiz Creation & Management**: Create quizzes with multiple-choice, text-answer, and diagram-based questions
- **QR Code Generation**: Automatically generate QR codes for easy quiz access
- **Real-time Analytics**: Track student submissions, scores, and performance
- **Quiz Control**: Activate/deactivate quizzes and manage questions
- **Student Tracking**: View detailed statistics for each quiz

### For Students
- **QR Code Access**: Simply scan a QR code to access quizzes instantly
- **Mobile Optimized**: Take quizzes on any device
- **Instant Feedback**: Get immediate results after submission
- **Quiz History**: View all past quiz attempts and scores
- **Progress Tracking**: Monitor your performance over time

## 🚀 Getting Started

### Step 1: Create FREE Supabase Account

1. Go to **https://supabase.com**
2. Click "Start your project" (100% FREE, no credit card)
3. Sign up with GitHub/Google/Email
4. Create a new project:
   - Choose a project name
   - Set a database password (save this!)
   - Select a region closest to you
   - Click "Create new project" (takes ~2 minutes)

### Step 2: Get Database Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string** section
3. Select **URI** tab
4. Copy the connection string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@...`)
5. Replace `[YOUR-PASSWORD]` with your actual database password

### Step 3: Setup Project

1. **Extract the project files**
   ```bash
   cd qr-quiz-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Edit `.env.local` file:
   ```env
   # Paste your Supabase connection string here:
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"

   # Generate a secret key (run: openssl rand -base64 32)
   NEXTAUTH_SECRET=your-secret-key-here

   # Leave as is for local development
   NEXTAUTH_URL=http://localhost:3000
   NODE_ENV=development
   ```

4. **Initialize the database**
   
   The tables will be created automatically on first run!

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Usage

### Teacher Workflow

1. **Register an account** as a Teacher
2. **Login** to access the teacher dashboard
3. **Create a quiz**:
   - Click "Create Quiz"
   - Enter quiz title and description
   - Add MCQ, text-answer, or diagram-based questions
   - Mark the correct answer for each question type
   - Set points for each question
4. **Share the QR code**:
   - View the generated QR code
   - Download or display it to students
5. **Monitor results**:
   - Click "Stats" to view submissions
   - See average scores and individual results

### Student Workflow

1. **Register an account** as a Student
2. **Scan the QR code** provided by your teacher
3. **Login** if prompted
4. **Answer all questions**:
   - Select options for MCQ questions
   - Write short answers for text/diagram questions
   - Track your progress with the progress bar
5. **Submit the quiz**:
   - Review your answers
   - Click "Submit Quiz"
6. **View your results**:
   - See your score immediately
   - Check your dashboard for quiz history

## 🗄️ Database Schema

The PostgreSQL database has 3 main tables:

### `users` Table
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(255)
email           VARCHAR(255) UNIQUE
password        VARCHAR(255) -- hashed with bcrypt
role            VARCHAR(50) -- 'teacher' or 'student'
created_at      TIMESTAMP
```

### `quizzes` Table
```sql
id              SERIAL PRIMARY KEY
title           VARCHAR(500)
description     TEXT
teacher_id      INTEGER (references users)
teacher_name    VARCHAR(255)
questions       JSONB -- array of questions
qr_code         TEXT -- base64 QR code image
is_active       BOOLEAN
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### `submissions` Table
```sql
id              SERIAL PRIMARY KEY
quiz_id         INTEGER (references quizzes)
quiz_title      VARCHAR(500)
student_id      INTEGER (references users)
student_name    VARCHAR(255)
student_email   VARCHAR(255)
answers         JSONB -- array of answers
score           INTEGER
total_points    INTEGER
submitted_at    TIMESTAMP
UNIQUE(quiz_id, student_id) -- one submission per student per quiz
```

## 🏗️ Project Structure

```
qr-quiz-system/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── quizzes/      # Quiz CRUD operations
│   │   ├── register/     # User registration
│   │   └── submissions/  # Quiz submissions
│   ├── dashboard/        # Dashboard page
│   ├── login/            # Login page
│   ├── quiz/[id]/        # Quiz taking page
│   ├── register/         # Registration page
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── providers.tsx     # Session provider
├── components/           # React components
│   ├── CreateQuizModal.tsx
│   ├── QuizCard.tsx
│   ├── QuizStatsModal.tsx
│   ├── StudentDashboard.tsx
│   └── TeacherDashboard.tsx
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   └── db.ts            # PostgreSQL connection & schema
├── types/
│   └── index.ts         # TypeScript type definitions
├── .env.local           # Environment variables
└── package.json         # Dependencies
```

## 🎨 Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Custom CSS animations
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Supabase (FREE tier)
- **ORM**: Vercel Postgres SDK (SQL queries)
- **Authentication**: NextAuth.js with JWT
- **QR Codes**: qrcode & qrcode.react
- **Password Hashing**: bcryptjs

## 🔒 Security Features

- Secure password hashing with bcrypt (10 rounds)
- JWT-based session management
- Role-based access control (RBAC)
- Protected API routes
- SQL injection prevention (parameterized queries)
- Environment variable configuration
- HTTPS support (in production)

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **NextAuth.js**: https://next-auth.js.org/
- **Vercel Deployment**: https://vercel.com/docs

**Happy quizzing! 🎉**
