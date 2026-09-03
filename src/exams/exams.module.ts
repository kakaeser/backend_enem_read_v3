import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service.js';
import { ExamsController } from './exams.controller.js';
import { QuestionsService } from './questions/questions.service.js';
import { QuestionsController } from './questions/questions.controller.js';
import { ResultsService } from './results/results.service.js';
import { ResultsController } from './results/results.controller.js';

@Module({
  providers: [ExamsService, QuestionsService, ResultsService],
  controllers: [ExamsController, QuestionsController, ResultsController]
})
export class ExamsModule {}
