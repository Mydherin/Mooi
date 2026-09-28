export interface ProductionHealth {
  state: 'healthy' | 'unhealthy';
  output: string;
  checkedAt: string;
}
