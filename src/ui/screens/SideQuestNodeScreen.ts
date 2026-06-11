import type { App } from "../App.ts";
import { gameState, createCombatFromRun } from "../../state/GameState.ts";
import { NODE_REGISTRY } from "../../data/nodes.ts";
import { availableNextNodes, visitNode } from "../../run/MapGraph.ts";
import { getSideQuestById } from "../../data/sideQuests.ts";
import { resolveQuestNode } from "../../run/QuestNodeDispatch.ts";
import { applyQuestOutcomeHook } from "../../run/QuestOutcomeApplicator.ts";
import { appendAdventureLogOnce } from "../../run/AdventureLog.ts";

export function resetSideQuestNodeScreenState(): void {
  // No module-scope phase state needed — screen is stateless beyond mapState.
}

export class SideQuestNodeScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    const run = gameState.run;
    const campaign = gameState.campaign;
    if (!run || !campaign) {
      gameState.screen = "map";
      this.app.render();
      return document.createElement("div");
    }

    const nodeId = run.mapState.currentNodeId;
    const nodeDef = NODE_REGISTRY[nodeId];
    const isSideQuestNode =
      nodeDef?.type === "side_route_start" ||
      nodeDef?.type === "side_route_node" ||
      nodeDef?.type === "side_route_return";

    if (!nodeDef || !isSideQuestNode) {
      gameState.screen = "map";
      this.app.render();
      return document.createElement("div");
    }

    const questDef = nodeDef.questId ? getSideQuestById(nodeDef.questId) : undefined;
    // Fall back to type-inferred role so nodes without questNodeRole never soft-lock.
    const role = nodeDef.questNodeRole ?? (
      nodeDef.type === "side_route_start" ? "start"
      : nodeDef.type === "side_route_return" ? "complete"
      : "advance"
    );

    const container = document.createElement("div");
    container.style.cssText = [
      "display:flex;flex-direction:column;align-items:center;",
      "padding:40px 24px;gap:20px;max-width:640px;margin:0 auto;",
      "background:linear-gradient(180deg,#0d1a1a 0%,#0a1010 100%);",
      "border:1px solid #1a4a4a;border-radius:10px;margin-top:40px;",
    ].join("");

    // ── Header ──────────────────────────────────────────────────────────────
    if (questDef) {
      const banner = document.createElement("div");
      banner.style.cssText =
        "font-size:11px;letter-spacing:0.12em;color:#4dd;text-transform:uppercase;font-weight:bold;opacity:0.8;";
      const roleLabel =
        role === "start" ? "Side Quest — Beginning"
        : role === "advance" ? "Side Quest — Continues"
        : role === "complete" ? "Side Quest — Resolved"
        : role === "fail" ? "Side Quest — Failed"
        : "Side Quest";
      banner.textContent = `${questDef.displayName}  ·  ${roleLabel}`;
      container.appendChild(banner);
    }

    const title = document.createElement("h2");
    title.textContent = nodeDef.title;
    title.style.cssText = "margin:0;text-align:center;color:#eef;font-size:22px;";
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = nodeDef.description;
    desc.style.cssText =
      "color:#bbb;font-size:14px;text-align:center;max-width:480px;line-height:1.7;";
    container.appendChild(desc);

    // ── Stage flavor text ───────────────────────────────────────────────────
    if (questDef && nodeDef.questStageId) {
      const stage = questDef.stages.find((s) => s.id === nodeDef.questStageId);
      const step = stage?.steps.find((st) => st.id === nodeDef.questStepId);
      const flavor = step?.description ?? stage?.description;
      if (flavor) {
        const flavorEl = document.createElement("div");
        flavorEl.textContent = flavor;
        flavorEl.style.cssText =
          "color:#999;font-size:13px;text-align:center;max-width:440px;" +
          "font-style:italic;line-height:1.6;border-top:1px solid #1a3a3a;padding-top:14px;";
        container.appendChild(flavorEl);
      }
    }

    // ── Action area ─────────────────────────────────────────────────────────
    if (role === "start") {
      container.appendChild(this.buildBtn("Enter Side Quest", "side-quest-begin", () => this.handleBegin(nodeId)));

    } else if (role === "advance") {
      if (nodeDef.encounterId) {
        // Arrived here after completing combat for this node.
        container.appendChild(
          this.buildNote("Your party has cleared this encounter. Proceed to continue the quest."),
        );
        container.appendChild(this.buildBtn("Proceed", "side-quest-advance", () => this.handleAdvance(nodeId)));
      } else {
        // Narrative/event node — show description, let the player read and continue.
        container.appendChild(this.buildBtn("Continue", "side-quest-advance", () => this.handleAdvance(nodeId)));
      }

    } else if (role === "complete") {
      const hookId = nodeDef.questOutcomeHookId ?? questDef?.outcomeHookIds[0];
      if (hookId) {
        const rewardNote = document.createElement("div");
        rewardNote.style.cssText =
          "color:#9f9;font-size:13px;text-align:center;max-width:420px;" +
          "border:1px solid #1a4a1a;border-radius:6px;padding:10px 16px;background:#081208;";
        rewardNote.textContent = `Quest resolved — rewards and consequences await.`;
        container.appendChild(rewardNote);
      }
      container.appendChild(this.buildBtn("Claim Reward & Return", "side-quest-complete", () => this.handleComplete(nodeId)));

    } else if (role === "fail") {
      container.appendChild(this.buildBtn("Accept Fate & Return", "side-quest-fail", () => this.handleFail(nodeId)));
    }

    return container;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Entered the side quest from the main map. Advance into the first interior node. */
  private handleBegin(startNodeId: string): void {
    const run = gameState.run;
    const campaign = gameState.campaign;
    if (!run || !campaign) return;

    const startDef = NODE_REGISTRY[startNodeId];
    if (!startDef) return;

    // Resolve the start node quest state (idempotent).
    resolveQuestNode(startDef, campaign.questProgress, campaign.currentActNumber);
    appendAdventureLogOnce(run, `sq_node:${startNodeId}`, {
      kind: "node_visit",
      text: `Side quest began: ${startDef.title}.`,
      nodeId: startNodeId,
    });

    // Advance into the first interior node.
    const nextId = availableNextNodes(run.mapState)[0];
    if (!nextId) {
      gameState.screen = "map";
      this.app.render();
      return;
    }
    visitNode(run.mapState, nextId);

    const nextDef = NODE_REGISTRY[nextId];
    if (nextDef?.encounterId) {
      // Launch combat — reward screen will route back to "map", which redirects here.
      const encounterId = nextDef.encounterId;
      gameState.combat = createCombatFromRun(run, encounterId, gameState.rng, nextDef.type);
      gameState.screen = "combat";
    } else {
      // No combat — render the advance screen directly.
      gameState.screen = "side_quest_node";
    }
    this.app.render();
  }

  /** Player has cleared or read a side_route_node step. Advance to the next node. */
  private handleAdvance(nodeId: string): void {
    const run = gameState.run;
    const campaign = gameState.campaign;
    if (!run || !campaign) return;

    const nodeDef = NODE_REGISTRY[nodeId];
    if (!nodeDef) return;

    // Update quest state for the step we just finished.
    resolveQuestNode(nodeDef, campaign.questProgress, campaign.currentActNumber);
    appendAdventureLogOnce(run, `sq_node:${nodeId}`, {
      kind: "node_visit",
      text: `Side quest progressed: ${nodeDef.title}.`,
      nodeId,
    });

    // Move to the next node.
    const nextId = availableNextNodes(run.mapState)[0];
    if (!nextId) {
      gameState.screen = "map";
      this.app.render();
      return;
    }
    visitNode(run.mapState, nextId);

    const nextDef = NODE_REGISTRY[nextId];
    if (nextDef?.encounterId) {
      // Next node is a combat — launch it. MapScreen redirect will bring us back here after reward.
      gameState.combat = createCombatFromRun(run, nextDef.encounterId, gameState.rng, nextDef.type);
      gameState.screen = "combat";
    } else {
      gameState.screen = "side_quest_node";
    }
    this.app.render();
  }

  /** Side quest is complete — apply rewards and return to the main map. */
  private handleComplete(nodeId: string): void {
    const run = gameState.run;
    const campaign = gameState.campaign;
    if (!run || !campaign) return;

    const returnDef = NODE_REGISTRY[nodeId];
    if (!returnDef) return;

    resolveQuestNode(returnDef, campaign.questProgress, campaign.currentActNumber);

    const questDef = returnDef.questId ? getSideQuestById(returnDef.questId) : undefined;
    const hookId = returnDef.questOutcomeHookId ?? questDef?.outcomeHookIds[0];
    if (hookId) applyQuestOutcomeHook(hookId, campaign);

    appendAdventureLogOnce(run, `sq_node:${nodeId}`, {
      kind: "node_visit",
      text: `Side quest completed: ${returnDef.title}.`,
      nodeId,
    });

    run.mapState.nodesCleared++;

    // Advance past the return node onto the main path so the map renders cleanly.
    const mainPathNodeId = returnDef.returnNodeId;
    if (mainPathNodeId) {
      visitNode(run.mapState, mainPathNodeId);
    }

    gameState.screen = "map";
    this.app.render();
  }

  /** Side quest failed — apply failure consequence and return. */
  private handleFail(nodeId: string): void {
    const run = gameState.run;
    const campaign = gameState.campaign;
    if (!run || !campaign) return;

    const nodeDef = NODE_REGISTRY[nodeId];
    if (!nodeDef) return;

    resolveQuestNode(nodeDef, campaign.questProgress, campaign.currentActNumber);

    const questDef = nodeDef.questId ? getSideQuestById(nodeDef.questId) : undefined;
    const hookId = nodeDef.questOutcomeHookId ?? questDef?.outcomeHookIds.find(
      (id) => id.includes("failed") || id.includes("abandoned"),
    );
    if (hookId) applyQuestOutcomeHook(hookId, campaign);

    run.mapState.nodesCleared++;
    const mainPathNodeId = nodeDef.returnNodeId;
    if (mainPathNodeId) visitNode(run.mapState, mainPathNodeId);

    gameState.screen = "map";
    this.app.render();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildBtn(label: string, testId: string, handler: () => void): HTMLElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = "padding:10px 32px;font-size:16px;margin-top:4px;";
    btn.setAttribute("data-testid", testId);
    btn.addEventListener("click", handler);
    return btn;
  }

  private buildNote(text: string): HTMLElement {
    const el = document.createElement("div");
    el.style.cssText =
      "color:#8cc;font-size:13px;text-align:center;max-width:420px;font-style:italic;";
    el.textContent = text;
    return el;
  }
}
