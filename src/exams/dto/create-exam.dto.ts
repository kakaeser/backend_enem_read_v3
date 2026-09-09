import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateExamDto {
  @IsString()
  @MinLength(3)
  nome!: string;

  @IsInt()
  @Min(1)
  qtdQuestoes!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  notaSimbolica?: number;
}
