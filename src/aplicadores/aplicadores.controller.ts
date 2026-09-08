import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AplicadoresService } from './aplicadores.service.js';
import { CreateAplicadorDto } from './dto/create-aplicador.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@Controller('aplicadores')
export class AplicadoresController {
  constructor(private aplicadores: AplicadoresService) {}

  @Post()
  create(@Body() dto: CreateAplicadorDto) {
    return this.aplicadores.create(dto);
  }

  @Get()
  findAll(@Query('provaId') provaId?: string) {
    const pid = provaId ? parseInt(provaId, 10) : undefined;
    return this.aplicadores.findAll(pid);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto) {
    return this.aplicadores.updateStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.aplicadores.remove(id);
  }
}
