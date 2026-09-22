import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ExamsModule } from './exams/exams.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { AplicadoresModule } from './aplicadores/aplicadores.module.js';

@Module({
  imports: [PrismaModule, ExamsModule, AuthModule, UserModule, AplicadoresModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
