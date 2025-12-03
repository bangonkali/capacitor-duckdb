import { testRegistry } from './TestRegistry';
import { registerBasicTests } from './core/basic';
import { registerDDLTests } from './core/ddl';
import { registerDMLTests } from './core/dml';
import { registerTypeTests } from './core/types';
import { registerErrorTests } from './core/errors';
import { registerSpatialTests } from './plugins/spatial';
import { registerVSSTests } from './plugins/vss';

export const initializeTests = () => {
    testRegistry.clear();

    registerBasicTests();
    registerDDLTests();
    registerDMLTests();
    registerTypeTests();
    registerErrorTests();
    registerSpatialTests();
    registerVSSTests();
};

export * from './types';
export * from './TestRegistry';
export * from './TestRunner';
