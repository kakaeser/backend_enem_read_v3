import { Module } from '@nestjs/common';
import { AplicadoresService } from './aplicadores.service.js';
import { AplicadoresController } from './aplicadores.controller.js';

@Module({
  providers: [AplicadoresService],
  controllers: [AplicadoresController]
})
export class AplicadoresModule {}
