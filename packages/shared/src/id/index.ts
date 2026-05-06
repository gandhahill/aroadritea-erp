import { randomUUID } from 'node:crypto';

export type EntityId = string;

export const generateId = (): EntityId => randomUUID();
