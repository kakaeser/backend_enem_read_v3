import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateParticipantDto } from './create-participant.dto.js';

export class BulkParticipantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParticipantDto)
  participants!: CreateParticipantDto[];
}
