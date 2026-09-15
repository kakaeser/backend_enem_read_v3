import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { BulkParticipantsDto } from './dto/bulk-participants.dto.js';
import { CreateParticipantDto } from './dto/create-participant.dto.js';
import { UpdatePresencaDto } from './dto/update-presenca.dto.js';
import { UpdateRedacaoDto } from './dto/update-redacao.dto.js';
import { ParticipantsService } from './participants.service.js';

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

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  importExcel(
    @Param('examId', ParseIntPipe) examId: number,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file) throw new BadRequestException('Envie o arquivo .xlsx no campo "file"');
    if (!/\.xlsx?$|\.xls$/i.test(file.originalname) && file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      throw new BadRequestException('Arquivo deve ser .xlsx');
    }
    return this.participants.importExcel(examId, file.buffer);
  }

  @Get()
  findAll(@Param('examId', ParseIntPipe) examId: number) {
    return this.participants.findAll(examId);
  }

  @Get('presentes')
  findAllPresente(@Param('examId', ParseIntPipe) examId: number) {
    return this.participants.findAllPresente(examId);
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
