import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: new InMemoryPrisma() },
        { provide: JwtService, useValue: { signAsync: async () => 'token', verifyAsync: async () => ({}) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
