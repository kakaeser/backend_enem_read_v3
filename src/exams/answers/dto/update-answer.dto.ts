import { IsString } from 'class-validator';

export class UpdateAnswerDto {
  @IsString()
  alternativa!: string;
}
