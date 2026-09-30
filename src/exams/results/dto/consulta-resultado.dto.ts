import { IsString, MinLength } from 'class-validator';

export class ConsultaResultadoDto {
  @IsString()
  @MinLength(4)
  codigo!: string;
}
