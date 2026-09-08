import { IsInt, IsString, MinLength } from 'class-validator';

export class AplicadorLoginDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsInt()
  provaId!: number;
}
