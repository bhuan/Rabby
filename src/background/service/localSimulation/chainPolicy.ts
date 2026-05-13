export type SimulationProvider = 'debank' | 'local-trace';

export interface ChainSimulationPolicy {
  chainId: number;
  providers: SimulationProvider[];
}

export const CHAIN_SIMULATION_POLICY: ChainSimulationPolicy[] = [
  {
    chainId: 143,
    providers: ['debank', 'local-trace'],
  },
  {
    chainId: 10143,
    providers: ['local-trace'],
  },
];

export const getPolicy = (chainId: number) =>
  CHAIN_SIMULATION_POLICY.find((p) => p.chainId === chainId);
