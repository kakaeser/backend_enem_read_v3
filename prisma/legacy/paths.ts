import { join } from 'node:path';

export const legacyDbPath = join(process.cwd(), 'prisma', 'legacy', 'database.db');
