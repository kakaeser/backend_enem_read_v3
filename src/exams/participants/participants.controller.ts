import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { BulkParticipantsDto } from './dto/bulk-participants.dto.js';
import { CreateParticipantDto } from './dto/create-participant.dto.js';
import { ListParticipantsQueryDto } from './dto/list-participants-query.dto.js';
import { UpdatePresencaDto } from './dto/update-presenca.dto.js';
import { UpdateRedacaoDto } from './dto/update-redacao.dto.js';
import { ParticipantsService } from './participants.service.js';

@ApiTags('participants')
@ApiBearerAuth('access-token')
@Controller('exams/:examId/participants')
@UseGuards(JwtAuthGuard)
export class ParticipantsController {
  constructor(private participants: ParticipantsService) {}

  @Post()
  create(@Param('examId', ParseIntPipe) examId: number, @Body() dto: CreateParticipantDto) {
    return this.participants.create(examId, dto);
  }

  @Post('bulk')
  createMany(@Param('examId', ParseIntPipe) examId: number, @Body() dto: BulkParticipantsDto) {
    return this.participants.createMany(examId, dto.participants);
  }

  @Get()
  findAll(
    @Param('examId', ParseIntPipe) examId: number,
    @Query() query: ListParticipantsQueryDto,
  ) {
    return this.participants.findAll(examId, query);
  }

  @Get('presentes')
  findAllPresente(
    @Param('examId', ParseIntPipe) examId: number,
    @Query() query: ListParticipantsQueryDto,
  ) {
    return this.participants.findAllPresente(examId, query);
  }

  @Patch(':id/presenca')
  updatePresenca(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePresencaDto,
  ) {
    return this.participants.updatePresenca(examId, id, dto.presenca);
  }

  @Patch(':id/redacao')
  updateRedacao(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRedacaoDto,
  ) {
    return this.participants.updateRedacao(examId, id, dto.redacaoNota);
  }

  @Delete(':id')
  remove(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.participants.remove(examId, id);
  }
}
