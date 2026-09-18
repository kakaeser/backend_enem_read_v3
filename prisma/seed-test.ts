import { PrismaClient } from '@prisma/client';
import * as readline from 'node:readline';

const prisma = new PrismaClient();
const TEST_EXAM_ID = 999;
const TEST_EXAM_NAME = 'EXAME TESTE 30q';

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

async function clearTestData() {
  console.log('[seed-test] Limpando dados de teste (exam 999)...');
  // Apaga answers dos participants/questions do exame teste
  const testQuestions = await prisma.question.findMany({ where: { examId: TEST_EXAM_ID }, select: { id: true } });
  const testParticipants = await prisma.participant.findMany({ where: { examId: TEST_EXAM_ID }, select: { id: true } });
  const qIds = testQuestions.map((q) => q.id);
  const pIds = testParticipants.map((p) => p.id);
  if (qIds.length || pIds.length) {
    await prisma.answer.deleteMany({ where: { OR: [{ questId: { in: qIds } }, { userId: { in: pIds } }] } });
  }
  await prisma.participant.deleteMany({ where: { examId: TEST_EXAM_ID } });
  await prisma.question.deleteMany({ where: { examId: TEST_EXAM_ID } });
  await prisma.exam.deleteMany({ where: { id: TEST_EXAM_ID } });
  // Reseta sequence se necessário (não deleta users/adms)
  console.log('[seed-test] Dados de teste removidos (adms/users preservados)');
}

async function createTestData() {
  const exists = await prisma.exam.findUnique({ where: { id: TEST_EXAM_ID } });
  if (exists) {
    console.log(`[seed-test] Exame teste ${TEST_EXAM_ID} já existe — pulando criação. Use "limpar" primeiro para recriar.`);
    return;
  }

  const exam = await prisma.exam.create({
    data: {
      id: TEST_EXAM_ID,
      nome: TEST_EXAM_NAME,
      qtdQuestoes: 30,
      notaSimbolica: 1000,
      status: 'in_progress',
      encerramento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`[seed-test] Exam criado id=${exam.id}`);

  const letters = ['A', 'B', 'C', 'D'] as const;
  const questions: { examId: number; numero: number; peso: number; correctAnswer: string; enunciado: string; alternativas: any }[] = [];
  for (let n = 1; n <= 30; n++) {
    const correct = letters[Math.floor(Math.random() * 4)];
    questions.push({
      examId: TEST_EXAM_ID,
      numero: n,
      peso: 1,
      correctAnswer: correct,
      enunciado: `Questão ${n} — enunciado de teste (exame ${TEST_EXAM_ID})`,
      alternativas: letters.map((l) => ({ letra: l, texto: `Alternativa ${l} da questão ${n}` })),
    });
  }
  // createMany não suporta Json com createMany? Usa create em loop para garantir
  for (const q of questions) {
    await prisma.question.create({ data: q });
  }
  console.log('[seed-test] 30 questions criadas');

  const qCreated = await prisma.question.findMany({ where: { examId: TEST_EXAM_ID }, select: { id: true } });

  for (let i = 1; i <= 10; i++) {
    const participant = await prisma.participant.create({
      data: {
        examId: TEST_EXAM_ID,
        nome: `Teste ${String(i).padStart(2, '0')}`,
        presenca: true,
        redacaoNota: Math.floor(Math.random() * 400) + 600, // 600-1000
      },
    });
    // 30 answers por participante
    const answers = qCreated.map((q) => ({
      userId: participant.id,
      questId: q.id,
      alternativa: letters[Math.floor(Math.random() * 4)],
      confidenceScore: null,
      manuallyReviewed: false,
    }));
    await prisma.answer.createMany({ data: answers, skipDuplicates: true });
  }
  console.log('[seed-test] 10 participants + 300 answers criados');

  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"exams"', 'exam_id'), (SELECT MAX(exam_id) FROM exams), true)`);
  console.log('[seed-test] Finalizado — dados reais e adms preservados');
}

async function main() {
  const ans = await ask('[seed-test] O que deseja? (iniciar = criar teste, limpar = remover teste, sair): ');
  if (ans === 'limpar' || ans === 'l' || ans === 'clear') {
    await clearTestData();
  } else if (ans === 'iniciar' || ans === 'i' || ans === 'create' || ans === '') {
    await createTestData();
  } else {
    console.log('Opção inválida — use "iniciar" ou "limpar"');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
