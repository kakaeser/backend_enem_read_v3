import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Rotas sem exigência de `X-App-Api-Key` (ex.: health / keep-alive). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
