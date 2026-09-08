import { IsEnum } from 'class-validator';

export enum AplicadorStatusDto {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
}

export class UpdateStatusDto {
  @IsEnum(AplicadorStatusDto)
  status!: AplicadorStatusDto;
}
