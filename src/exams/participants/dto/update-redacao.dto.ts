import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateRedacaoDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  redacaoNota!: number | null;
}
