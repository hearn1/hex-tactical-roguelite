import type { RunState } from "../state/RunState.ts";

export type AdventureLogKind =
  | "run_start"
  | "node_visit"
  | "combat_victory"
  | "elite_defeated"
  | "boss_defeated"
  | "hero_downed"
  | "level_up"
  | "loot_gained"
  | "event_choice"
  | "recruit_joined"
  | "pet_joined"
  | "run_end";

export interface AdventureLogEntry {
  id: string;
  index: number;
  kind: AdventureLogKind;
  text: string;
  nodeId?: string;
  encounterId?: string;
  heroInstanceId?: string;
  heroName?: string;
  itemId?: string;
  eventId?: string;
  choiceId?: string;
  outcome?: "success" | "partial" | "failure" | "none";
  runStatus?: "won" | "lost";
  /**
   * Deterministic duplicate key. appendAdventureLogOnce uses this to prevent
   * duplicate entries when screens re-render or state is revisited.
   */
  sourceKey?: string;
}

export function ensureAdventureLog(run: RunState): AdventureLogEntry[] {
  if (!run.adventureLog) run.adventureLog = [];
  return run.adventureLog;
}

export function appendAdventureLog(
  run: RunState,
  entry: Omit<AdventureLogEntry, "id" | "index">,
): AdventureLogEntry {
  const log = ensureAdventureLog(run);
  const index = log.length;
  const id = `${index}:${entry.kind}:${entry.sourceKey ?? "entry"}`;
  const full: AdventureLogEntry = { ...entry, id, index };
  log.push(full);
  return full;
}

export function appendAdventureLogOnce(
  run: RunState,
  sourceKey: string,
  entry: Omit<AdventureLogEntry, "id" | "index" | "sourceKey">,
): AdventureLogEntry | null {
  const log = ensureAdventureLog(run);
  if (log.some((e) => e.sourceKey === sourceKey)) return null;
  return appendAdventureLog(run, { ...entry, sourceKey });
}

export function buildRunEpilogue(run: RunState): string[] {
  const log = ensureAdventureLog(run);
  const lines: string[] = [];

  const start = log.find((e) => e.kind === "run_start");
  if (start) lines.push(start.text);

  const end = log.find((e) => e.kind === "run_end");
  if (end) lines.push(end.text);

  lines.push(`Nodes cleared: ${run.mapState.nodesCleared}`);
  lines.push(`Elites defeated: ${run.mapState.elitesDefeated}`);
  lines.push(run.mapState.bossDefeated ? "Boss defeated." : "Boss not reached.");

  const loot = log.filter((e) => e.kind === "loot_gained");
  for (const l of loot.slice(0, 3)) lines.push(l.text);

  const downed = log.filter((e) => e.kind === "hero_downed");
  for (const d of downed) lines.push(d.text);

  const levelUps = log.filter((e) => e.kind === "level_up");
  for (const l of levelUps) lines.push(l.text);

  const recruits = log.filter((e) => e.kind === "recruit_joined" || e.kind === "pet_joined");
  for (const r of recruits) lines.push(r.text);

  const events = log.filter((e) => e.kind === "event_choice");
  for (const ev of events.slice(-3)) lines.push(ev.text);

  return lines;
}
