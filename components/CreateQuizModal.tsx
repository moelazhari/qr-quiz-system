'use client';

import { useState } from 'react';
import { Question } from '@/types';

interface CreateQuizModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateQuizModal({ onClose, onSuccess }: CreateQuizModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    points: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addQuestion = () => {
    if (!currentQuestion.question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (currentQuestion.options.some(opt => !opt.trim())) {
      setError('Please fill in all options');
      return;
    }

    const newQuestion: Question = {
      id: Date.now().toString(),
      ...currentQuestion,
    };

    setQuestions([...questions, newQuestion]);
    setCurrentQuestion({
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1,
    });
    setError('');
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a quiz title');
      return;
    }

    if (questions.length === 0) {
      setError('Please add at least one question');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          questions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create quiz');
      }

      onSuccess();
    } catch (err) {
      setError('Failed to create quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold gradient-text">Create New Quiz</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Quiz Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Enter quiz title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field min-h-[80px]"
                placeholder="Enter quiz description"
              />
            </div>
          </div>

          {/* Questions List */}
          {questions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Questions ({questions.length})</h3>
              {questions.map((q, index) => (
                <div key={q.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-white mb-2">
                        {index + 1}. {q.question}
                      </p>
                      <div className="space-y-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className="flex items-center text-sm">
                            <span className={`${i === q.correctAnswer ? 'text-green-400' : 'text-slate-400'}`}>
                              {i === q.correctAnswer && '✓ '}
                              {String.fromCharCode(65 + i)}. {opt}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-slate-500 text-xs mt-2">{q.points} {q.points === 1 ? 'point' : 'points'}</p>
                    </div>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="text-red-400 hover:text-red-300 ml-4"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Question Form */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Add Question</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Question
                </label>
                <input
                  type="text"
                  value={currentQuestion.question}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                  className="input-field"
                  placeholder="Enter your question"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Options
                </label>
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={currentQuestion.correctAnswer === index}
                        onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: index })}
                        className="w-4 h-4 text-indigo-500"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...currentQuestion.options];
                          newOptions[index] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, options: newOptions });
                        }}
                        className="input-field flex-1"
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-2">Select the correct answer with the radio button</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Points
                </label>
                <input
                  type="number"
                  min="1"
                  value={currentQuestion.points}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) || 1 })}
                  className="input-field w-32"
                />
              </div>

              <button
                onClick={addQuestion}
                className="btn-secondary w-full"
              >
                Add Question
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || questions.length === 0}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
