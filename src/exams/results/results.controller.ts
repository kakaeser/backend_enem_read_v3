import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ResultsService } from './results.service.js';

@Controller('exams/:examId/results')
@UseGuards(JwtAuthGuard)
export class ResultsController {
  constructor(private results: ResultsService) {}

  @Get()
  ranking(@Param('examId', ParseIntPipe) examId: number) {
    return this.results.getRanking(examId);
  }

  @Get(':participantId')
  detail(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    return this.results.getDetail(examId, participantId);
  }
}
