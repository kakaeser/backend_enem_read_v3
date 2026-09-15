import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateParticipantDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsBoolean()
  presenca?: boolean;

  @IsOptional()
  @IsInt()
  aplicadorId?: number;
}
