import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { AnswersService } from './answers.service.js';
import { BulkAnswersDto } from './dto/bulk-answers.dto.js';
import { UpdateAnswerDto } from './dto/update-answer.dto.js';

@Controller('exams/:examId/answers')
@UseGuards(JwtAuthGuard)
export class AnswersController {
  constructor(private answers: AnswersService) {}

  @Post('bulk')
  bulk(@Param('examId', ParseIntPipe) examId: number, @Body() dto: BulkAnswersDto) {
    return this.answers.bulkUpsert(examId, dto.answers);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnswerDto) {
    return this.answers.update(id, dto.alternativa);
  }

  @Get('participant/:participantId')
  findByParticipant(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    return this.answers.findByParticipant(examId, participantId);
  }
}
