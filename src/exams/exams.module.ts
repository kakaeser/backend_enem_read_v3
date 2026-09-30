import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AnswersController } from './answers/answers.controller.js';
import { AnswersService } from './answers/answers.service.js';
import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';
import { ParticipantsController } from './participants/participants.controller.js';
import { ParticipantsService } from './participants/participants.service.js';
import { QuestionsController } from './questions/questions.controller.js';
import { QuestionsService } from './questions/questions.service.js';
import { PublicResultsController } from './results/public-results.controller.js';
import { ResultsController } from './results/results.controller.js';
import { ResultsExportService } from './results/results-export.service.js';
import { ResultsService } from './results/results.service.js';

@Module({
  imports: [AuthModule, MailModule],
  providers: [ExamsService, QuestionsService, ResultsService, ResultsExportService, ParticipantsService, AnswersService],
  controllers: [
    ExamsController,
    QuestionsController,
    ResultsController,
    PublicResultsController,
    ParticipantsController,
    AnswersController,
  ],
})
export class ExamsModule {}
