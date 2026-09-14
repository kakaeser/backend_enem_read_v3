import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { BulkQuestionsDto } from './dto/bulk-questions.dto.js';
import { QuestionsService } from './questions.service.js';

@Controller('exams/:examId/questions')
export class QuestionsController {
  constructor(private questions: QuestionsService) {}

  @UseGuards(JwtAuthGuard)
  @Put('bulk')
  bulk(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: BulkQuestionsDto,
  ) {
    return this.questions.bulkUpsert(examId, dto.questions);
  }

  @Get()
  findAll(@Param('examId', ParseIntPipe) examId: number) {
    return this.questions.findAll(examId);
  }

  @Get(':id')
  findOne(@Param('examId', ParseIntPipe) examId: number, @Param('id', ParseIntPipe) id: number) {
    return this.questions.findOne(examId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('examId', ParseIntPipe) examId: number, @Param('id', ParseIntPipe) id: number) {
    return this.questions.remove(examId, id);
  }
}
