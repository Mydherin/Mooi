import type { ProductionSnapshot } from './ProductionSnapshot';

export type ProductionStreamEvent =
  | { type: 'production.sync'; data: { snapshot: ProductionSnapshot; logs: string[] } }
  | { type: 'production.updated'; data: ProductionSnapshot }
  | { type: 'production.log'; data: { operationId: string; lines: string[] } }
  | { type: 'production.configuration'; data: { revision: number } };
