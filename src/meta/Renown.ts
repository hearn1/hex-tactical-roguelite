import type { RunState } from "../state/RunState.ts";

export interface RenownBreakdown {
  nodes: number;
  elites: number;
  boss: number;
  characters: number;
  minimumApplied: boolean;
  total: number;
}

export function computeRenown(run: RunState): RenownBreakdown {
  const nodesContrib = run.mapState.nodesCleared * 2;
  const elitesContrib = run.mapState.elitesDefeated * 5;
  const bossContrib = run.mapState.bossDefeated ? 15 : 0;
  const charsContrib = run.party.filter((p) => p.level >= 2).length;

  let total = nodesContrib + elitesContrib + bossContrib + charsContrib;
  let minimumApplied = false;

  if (run.runStatus === "lost" && total < 1) {
    total = 1;
    minimumApplied = true;
  }

  return {
    nodes: nodesContrib,
    elites: elitesContrib,
    boss: bossContrib,
    characters: charsContrib,
    minimumApplied,
    total,
  };
}
