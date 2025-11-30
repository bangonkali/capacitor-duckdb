import { registerPlugin } from '@capacitor/core';

import type { CapacitorDuckDbPlugin } from './definitions';

const CapacitorDuckDb = registerPlugin<CapacitorDuckDbPlugin>('CapacitorDuckDb', {
  web: () => import('./web').then((m) => new m.CapacitorDuckDbWeb()),
});

export * from './definitions';
export { CapacitorDuckDb };
