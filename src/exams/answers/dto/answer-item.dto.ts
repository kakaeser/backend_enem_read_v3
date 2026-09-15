import { IsInt, IsString } from 'class-validator';

export class AnswerItemDto {
  @IsInt()
  userId!: number;

  @IsInt()
  questId!: number;

  @IsString()
  alternativa!: string;
}
