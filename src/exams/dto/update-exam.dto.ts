import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  notaSimbolica?: number;
}
