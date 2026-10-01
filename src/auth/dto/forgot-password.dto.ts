import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../common/normalize-email.transform.js';

export class ForgotPasswordDto {
  @IsEmail()
  @NormalizeEmail()
  email!: string;
}
