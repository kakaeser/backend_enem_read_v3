import { Test, TestingModule } from '@nestjs/testing';
import { AplicadoresController } from './aplicadores.controller.js';

describe('AplicadoresController', () => {
  let controller: AplicadoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AplicadoresController],
    }).compile();

    controller = module.get<AplicadoresController>(AplicadoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
