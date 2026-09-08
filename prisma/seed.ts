import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { join } from 'node:path';

const prisma = new PrismaClient();
const legacyPath = join(process.cwd(), 'prisma', 'legacy', 'database.db');

async function main() {
  console.log(`[seed] Lendo legado de ${legacyPath}`);
  const db = new Database(legacyPath, { readonly: true });

  // Limpa na ordem reversa (Answer -> Question/Participant -> Exam)
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.aplicador.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.adm.deleteMany();

  // 1. Adm default (senha: admin123)
  await prisma.adm.create({
    data: {
      email: 'admin@read.local',
      senha: '$2b$10$9X3trfPRWrM4tO.4ZcVdruh/WTR1AlgyCE7M9BFpDmKYOal2Zoswa', // bcrypt hash de admin123
    },
  });
  console.log('[seed] Adm default criado (admin@read.local / admin123)');

  // 2. Exams (preserva id 1 e 3) — colunas legadas: exam_name, questions_numbers, symbolic_note, ended_at
  const exams = db.prepare('SELECT exam_id, exam_name, questions_numbers, symbolic_note, created_at, updated_at, status, ended_at FROM exams').all() as any[];
  for (const e of exams) {
    await prisma.exam.create({
      data: {
        id: e.exam_id,
        nome: e.exam_name,
        qtdQuestoes: e.questions_numbers,
        notaSimbolica: e.symbolic_note ?? 1000,
        status: e.status as any,
        encerramento: e.ended_at ? new Date(e.ended_at) : null,
        createdAt: e.created_at ? new Date(e.created_at) : new Date(),
        updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
      },
    });
  }
  console.log(`[seed] ${exams.length} exams migrados (ids preservados)`);

  // Ajusta sequence do Postgres para não conflitar com ids explícitos
  if (exams.length) {
    const maxId = Math.max(...exams.map((e) => e.exam_id));
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"exams"', 'exam_id'), ${maxId}, true)`);
  }

  // 3. Questions — só gabarito no legado, cria placeholder para enunciado/alternativas
  const questions = db.prepare('SELECT id, exam_id, numero, peso, question_correct_answer FROM questoes').all() as any[];
  for (const q of questions) {
    await prisma.question.create({
      data: {
        id: q.id,
        examId: q.exam_id,
        numero: q.numero,
        peso: q.peso ?? 1,
        correctAnswer: q.question_correct_answer || 'A',
        enunciado: `Questão ${q.numero} (migrada — enunciado não existia no legado)`,
        alternativas: [
          { letra: 'A', texto: '' },
          { letra: 'B', texto: '' },
          { letra: 'C', texto: '' },
          { letra: 'D', texto: '' },
          { letra: 'E', texto: '' },
        ],
      },
    });
  }
  console.log(`[seed] ${questions.length} questions migradas (com placeholder)`);

  if (questions.length) {
    const maxQ = Math.max(...questions.map((q) => q.id));
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"questoes"', 'id'), ${maxQ}, true)`);
  }

  // 4. Participants — colunas legadas: presente, essay_points
  const participants = db.prepare('SELECT id, exam_id, nome, presente, essay_points FROM participantes').all() as any[];
  for (const p of participants) {
    await prisma.participant.create({
      data: {
        id: p.id,
        examId: p.exam_id,
        nome: p.nome,
        presenca: !!p.presente,
        redacaoNota: p.essay_points ?? null,
      },
    });
  }
  console.log(`[seed] ${participants.length} participants migrados`);

  if (participants.length) {
    const maxP = Math.max(...participants.map((p) => p.id));
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"participantes"', 'id'), ${maxP}, true)`);
  }

  // 5. Answers — colunas legadas: marked_answer, confidence_score, manually_reviewed (bulk para 4k+ linhas)
  const answers = db.prepare('SELECT id, user_id, quest_id, exam_id, marked_answer, confidence_score, manually_reviewed FROM resultados').all() as any[];
  const answerData = answers.map((a) => ({
    id: a.id,
    userId: a.user_id,
    questId: a.quest_id,
    alternativa: a.marked_answer,
    confidenceScore: a.confidence_score ?? null,
    manuallyReviewed: !!a.manually_reviewed,
  }));
  // batch de 1000 para não estourar param limit do Postgres
  for (let i = 0; i < answerData.length; i += 1000) {
    const batch = answerData.slice(i, i + 1000);
    await prisma.answer.createMany({ data: batch, skipDuplicates: true });
    console.log(`[seed] answers batch ${i / 1000 + 1} (${batch.length}) inserido`);
  }
  console.log(`[seed] ${answers.length} answers migradas (bulk)`);

  if (answers.length) {
    const maxA = Math.max(...answers.map((a) => a.id));
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"resultados"', 'id'), ${maxA}, true)`);
  }

  db.close();
  console.log('[seed] Finalizado com sucesso');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
