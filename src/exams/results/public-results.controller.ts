import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ConsultaResultadoDto } from './dto/consulta-resultado.dto.js';
import { ResultsService } from './results.service.js';

@ApiTags('resultados (público)')
@Controller('resultados')
export class PublicResultsController {
  constructor(private results: ResultsService) {}

  @Get()
  table() {
    return this.results.listDivulgados();
  }

  @Post(':examId/consulta')
  async consulta(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: ConsultaResultadoDto,
    @Req() req: Request,
  ) {
    await this.results.assertDivulgado(examId);
    const clientKey = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    this.results.assertConsultaRateLimit(clientKey);
    return this.results.consultaByCode(examId, dto.codigo);
  }

  @Get(':examId')
  async publicResults(@Param('examId', ParseIntPipe) examId: number) {
    await this.results.assertDivulgado(examId);
    return this.results.getPublicResults(examId);
  }
}
