import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AlternativaDto {
  @IsString()
  letra!: string; // A-D

  @IsString()
  texto!: string;
}

export class QuestionBulkItemDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsInt()
  @Min(1)
  numero!: number;

  @IsString()
  enunciado!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlternativaDto)
  alternativas!: AlternativaDto[];

  @IsString()
  correctAnswer!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  peso?: number;
}

export class BulkQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionBulkItemDto)
  questions!: QuestionBulkItemDto[];
}
