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
  results_release_mode?: 'immediate' | 'after_review';
  questions: Question[];
  qr_code?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type DiagramNodeKind = 'entity' | 'pseudo_entity' | 'attribute' | 'association' | 'inheritance';

export type DiagramCardinality = '0' | '1' | 'N' | 'M';

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  label: string;
  x: number;
  y: number;
  attributes?: string[];
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceCardinality?: DiagramCardinality;
  targetCardinality?: DiagramCardinality;
}

export interface DiagramModel {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  actionLog?: DiagramActionEvent[];
}

export type DiagramActionType =
  | 'node_add'
  | 'node_update'
  | 'node_move'
  | 'node_delete'
  | 'edge_add'
  | 'edge_update'
  | 'edge_delete';

export interface DiagramVectorSnapshot {
  subjectType: 'node' | 'edge';
  subjectId: string;
  vector: string;
}

export interface DiagramActionEvent {
  id: string;
  type: DiagramActionType;
  timestamp: string;
  subjectId: string;
  summary: string;
  vectors: DiagramVectorSnapshot[];
}

export interface DiagramGradeDetails {
  matchedItems: number;
  totalItems: number;
  missingNodes: string[];
  extraNodes: string[];
  missingAttributes: string[];
  extraAttributes: string[];
  missingLinks: string[];
  extraLinks: string[];
  cardinalityMismatches: string[];
  meriseIssues: string[];
}

export interface Question {
  id: string;
  type?: 'mcq' | 'text' | 'diagram';
  gradingMode?: 'auto' | 'manual';
  question: string;
  questionImageUrl?: string;
  options?: string[];
  correctAnswer?: number;
  correctTextAnswer?: string;
  acceptedTextAnswers?: string[];
  requiredKeywords?: string[];
  diagramImageUrl?: string;
  diagramTemplate?: DiagramModel;
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
  status?: 'pending_review' | 'graded';
  is_released?: boolean;
  submitted_at: Date;
}

export interface Answer {
  questionId: string;
  response: string | number | DiagramModel;
  isCorrect: boolean;
  points: number;
  reviewed?: boolean;
  feedback?: string[];
  autoGradeDetails?: DiagramGradeDetails;
}

export interface QuizStats {
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  submissions: Submission[];
}
