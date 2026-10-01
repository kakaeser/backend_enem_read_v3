/** DDL SQLite legado (v2) + colunas v3 em questoes (enunciado, alternativas). */
export const LEGACY_SQLITE_DDL = `
CREATE TABLE exams (
  exam_id INTEGER NOT NULL,
  exam_name VARCHAR(255) NOT NULL,
  questions_numbers INTEGER NOT NULL,
  symbolic_note INTEGER NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  status VARCHAR(50),
  ended_at DATETIME,
  PRIMARY KEY (exam_id)
);

CREATE TABLE participantes (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  presente BOOLEAN DEFAULT 0,
  essay_points FLOAT DEFAULT 0.0
);

CREATE TABLE questoes (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  peso INTEGER DEFAULT 1,
  question_correct_answer VARCHAR(10),
  enunciado TEXT,
  alternativas TEXT,
  UNIQUE (exam_id, numero)
);

CREATE TABLE resultados (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  quest_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  exam_id INTEGER NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
  marked_answer VARCHAR(10),
  confidence_score REAL,
  manually_reviewed BOOLEAN DEFAULT 0,
  UNIQUE (user_id, quest_id)
);

CREATE INDEX idx_exam_participants ON participantes(exam_id);
CREATE INDEX idx_exam_questions ON questoes(exam_id);
CREATE INDEX idx_exam_responses ON resultados(exam_id);
CREATE INDEX idx_participant_responses ON resultados(user_id);
`;
