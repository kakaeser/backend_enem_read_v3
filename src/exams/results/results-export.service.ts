import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { examResultsFilename } from '../../common/slugify.util.js';
import { ResultsService } from './results.service.js';

const SHEET_NAME = 'Ranking';
const HEADERS = ['Posição', 'Nome', 'Nota ponderada', 'Redação', 'Total', 'Acertos', 'Respondidas'];

function formatNota(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class ResultsExportService {
  constructor(private results: ResultsService) {}

  async buildRankingSpreadsheetBuffer(examId: number): Promise<{ buffer: Buffer; filename: string; examNome: string }> {
    const { exam, ranking } = await this.results.getRanking(examId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.addRow(HEADERS);

    ranking.forEach((row, index) => {
      sheet.addRow([
        index + 1,
        row.nome,
        formatNota(row.ponderada),
        row.redacao != null ? formatNota(row.redacao) : '',
        formatNota(row.total),
        row.acertos,
        row.respondidas,
      ]);
    });

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const filename = examResultsFilename(exam.id, exam.nome);
    return { buffer, filename, examNome: exam.nome };
  }
}
