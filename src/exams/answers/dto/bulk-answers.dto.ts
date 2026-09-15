import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AnswerItemDto } from './answer-item.dto.js';

export class BulkAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers!: AnswerItemDto[];
}
