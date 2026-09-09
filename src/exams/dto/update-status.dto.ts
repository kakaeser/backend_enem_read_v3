import { IsEnum } from 'class-validator';

export enum ExamStatusDto {
  draft = 'draft',
  in_progress = 'in_progress',
  completed = 'completed',
}

export class UpdateStatusDto {
  @IsEnum(ExamStatusDto)
  status!: ExamStatusDto;
}
