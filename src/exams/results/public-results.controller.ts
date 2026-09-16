import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ResultsService } from './results.service.js';

@Controller('resultados')
export class PublicResultsController {
  constructor(private results: ResultsService) {}

  @Get()
  table() {
    return this.results.listDivulgados();
  }

  @Get(':examId')
  async ranking(@Param('examId', ParseIntPipe) examId: number) {
    await this.results.assertDivulgado(examId);
    return this.results.getRanking(examId);
  }

  @Get(':examId/:participantId')
  async detail(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    await this.results.assertDivulgado(examId);
    return this.results.getDetail(examId, participantId);
  }
}
