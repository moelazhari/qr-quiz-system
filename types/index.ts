export interface User {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: 'teacher' | 'student';
  created_at?: Date;
}

export interface Quiz {
  id?: number;
  title: string;
  description: string;
  teacher_id: number;
  teacher_name: string;
  questions: Question[];
  qr_code?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface Question {
  id: string;
  type?: 'mcq' | 'text' | 'diagram';
  question: string;
  options?: string[];
  correctAnswer?: number;
  correctTextAnswer?: string;
  diagramImageUrl?: string;
  points: number;
}

export interface Submission {
  id?: number;
  quiz_id: number;
  quiz_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  answers: Answer[];
  score: number;
  total_points: number;
  submitted_at: Date;
}

export interface Answer {
  questionId: string;
  response: string | number;
  isCorrect: boolean;
  points: number;
}

export interface QuizStats {
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  submissions: Submission[];
}
