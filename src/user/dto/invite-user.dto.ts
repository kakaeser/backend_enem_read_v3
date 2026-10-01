import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../common/normalize-email.transform.js';

export class InviteUserDto {
  @IsEmail()
  @NormalizeEmail()
  email!: string;
}
