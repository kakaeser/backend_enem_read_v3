import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';
import { QuestionsController } from './questions/questions.controller.js';
import { QuestionsService } from './questions/questions.service.js';
import { ResultsController } from './results/results.controller.js';
import { ResultsService } from './results/results.service.js';

@Module({
  imports: [AuthModule],
  providers: [ExamsService, QuestionsService, ResultsService],
  controllers: [ExamsController, QuestionsController, ResultsController],
})
export class ExamsModule {}
