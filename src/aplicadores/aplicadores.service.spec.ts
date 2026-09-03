import { Test, TestingModule } from '@nestjs/testing';
import { AplicadoresService } from './aplicadores.service.js';

describe('AplicadoresService', () => {
  let service: AplicadoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AplicadoresService],
    }).compile();

    service = module.get<AplicadoresService>(AplicadoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
