import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AplicadoresController } from './aplicadores.controller.js';
import { AplicadoresService } from './aplicadores.service.js';

@Module({
  imports: [AuthModule],
  providers: [AplicadoresService],
  controllers: [AplicadoresController],
})
export class AplicadoresModule {}
