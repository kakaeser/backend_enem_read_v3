/**
 * Exporta provas status=completed do Neon (DATABASE_URL) para prisma/legacy/database.db.
 *
 * Uso:
 *   npm run backup:legacy
 *   npm run backup:legacy -- --no-backup-previous
 *
 * Verificação manual:
 *   sqlite3 prisma/legacy/database.db "SELECT exam_id, exam_name, status FROM exams;"
 *   sqlite3 prisma/legacy/database.db "SELECT COUNT(*) FROM questoes WHERE enunciado IS NOT NULL;"
 */
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { legacyDbPath } from './legacy/paths.js';
import { LEGACY_SQLITE_DDL } from './legacy/sqlite-schema.js';

const prisma = new PrismaClient();

const backupPrevious = !process.argv.includes('--no-backup-previous');

function backupExistingDb(path: string) {
  if (!existsSync(path)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bakPath = `${path}.bak-${stamp}`;
  renameSync(path, bakPath);
  console.log(`[backup] Cópia anterior em ${bakPath}`);
  for (const suffix of ['-shm', '-wal']) {
    const sidecar = path + suffix;
    if (existsSync(sidecar)) unlinkSync(sidecar);
  }
}

function setSqliteSequence(db: Database.Database, table: string, maxId: number) {
  if (maxId <= 0) return;
  const updated = db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(maxId, table);
  if (updated.changes === 0) {
    db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, maxId);
  }
}

async function main() {
  console.log('[backup] Lendo provas completed do Neon…');
  const exams = await prisma.exam.findMany({
    where: { status: 'completed' },
    orderBy: { id: 'asc' },
    include: {
      questions: { orderBy: { numero: 'asc' } },
      participants: {
        include: {
          answers: {
            include: { quest: { select: { examId: true } } },
          },
        },
      },
    },
  });

  if (exams.length === 0) {
    console.warn('[backup] Nenhuma prova com status=completed — nada exportado.');
    return;
  }

  const examIds = exams.map((e) => e.id);
  console.log(`[backup] ${exams.length} prova(s): exam_id ${examIds.join(', ')}`);

  mkdirSync(dirname(legacyDbPath), { recursive: true });
  if (backupPrevious) {
    backupExistingDb(legacyDbPath);
  } else if (existsSync(legacyDbPath)) {
    unlinkSync(legacyDbPath);
  }

  const db = new Database(legacyDbPath);
  db.pragma('foreign_keys = ON');
  db.exec(LEGACY_SQLITE_DDL);

  const insertExam = db.prepare(`
    INSERT INTO exams (exam_id, exam_name, questions_numbers, symbolic_note, created_at, updated_at, status, ended_at)
    VALUES (@exam_id, @exam_name, @questions_numbers, @symbolic_note, @created_at, @updated_at, @status, @ended_at)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO questoes (id, exam_id, numero, peso, question_correct_answer, enunciado, alternativas)
    VALUES (@id, @exam_id, @numero, @peso, @question_correct_answer, @enunciado, @alternativas)
  `);
  const insertParticipant = db.prepare(`
    INSERT INTO participantes (id, exam_id, nome, presente, essay_points)
    VALUES (@id, @exam_id, @nome, @presente, @essay_points)
  `);
  const insertAnswer = db.prepare(`
    INSERT INTO resultados (id, user_id, quest_id, exam_id, marked_answer, confidence_score, manually_reviewed)
    VALUES (@id, @user_id, @quest_id, @exam_id, @marked_answer, @confidence_score, @manually_reviewed)
  `);

  let questionCount = 0;
  let participantCount = 0;
  let answerCount = 0;
  let maxQuestionId = 0;
  let maxParticipantId = 0;
  let maxAnswerId = 0;

  const writeAll = db.transaction(() => {
    for (const exam of exams) {
      insertExam.run({
        exam_id: exam.id,
        exam_name: exam.nome,
        questions_numbers: exam.qtdQuestoes,
        symbolic_note: exam.notaSimbolica,
        created_at: exam.createdAt.toISOString(),
        updated_at: exam.updatedAt.toISOString(),
        status: exam.status,
        ended_at: exam.encerramento?.toISOString() ?? null,
      });

      for (const q of exam.questions) {
        insertQuestion.run({
          id: q.id,
          exam_id: q.examId,
          numero: q.numero,
          peso: q.peso,
          question_correct_answer: q.correctAnswer,
          enunciado: q.enunciado,
          alternativas: JSON.stringify(q.alternativas),
        });
        questionCount++;
        maxQuestionId = Math.max(maxQuestionId, q.id);
      }

      for (const p of exam.participants) {
        insertParticipant.run({
          id: p.id,
          exam_id: p.examId,
          nome: p.nome,
          presente: p.presenca ? 1 : 0,
          essay_points: p.redacaoNota,
        });
        participantCount++;
        maxParticipantId = Math.max(maxParticipantId, p.id);

        for (const a of p.answers) {
          insertAnswer.run({
            id: a.id,
            user_id: a.userId,
            quest_id: a.questId,
            exam_id: a.quest.examId,
            marked_answer: a.alternativa,
            confidence_score: a.confidenceScore,
            manually_reviewed: a.manuallyReviewed ? 1 : 0,
          });
          answerCount++;
          maxAnswerId = Math.max(maxAnswerId, a.id);
        }
      }
    }

    setSqliteSequence(db, 'questoes', maxQuestionId);
    setSqliteSequence(db, 'participantes', maxParticipantId);
    setSqliteSequence(db, 'resultados', maxAnswerId);
  });

  writeAll();
  db.close();

  console.log(
    `[backup] Gravado em ${legacyDbPath}: ${exams.length} exams, ${questionCount} questoes, ${participantCount} participantes, ${answerCount} resultados`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
