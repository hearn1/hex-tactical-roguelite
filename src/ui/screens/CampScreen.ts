import type { App } from "../App.ts";
import { gameState, routeAfterXp } from "../../state/GameState.ts";
import {
  restParty,
  trainPartyMember,
  brewPotion,
  prepareForCombat,
  CAMP_BREW_POTION_COST,
} from "../../run/Events.ts";
import { enqueuePendingLevelUps } from "../../run/LevelUp.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { POTION_REGISTRY } from "../../data/potions.ts";
import type { CampAction, CampNodeState, RunState } from "../../state/RunState.ts";

/** Actions that count as "recovery" — only one of these is allowed per camp visit (anti-glut). */
const RECOVERY_ACTIONS: ReadonlySet<CampAction> = new Set<CampAction>(["rest", "brew"]);

const TRAIN_XP = 5;

// Module-level state persists across CampScreen instances created by App.render().
// Keep only transient UI flow here; persistent per-camp choices/logs live on RunState.campStates.
let phase: "menu" | "confirm" = "menu";
let confirmAction: CampAction | null = null;
let pickingHero: boolean = false;
let lastRenderedNodeId: string | null = null;

function resetTransientState(): void {
  phase = "menu";
  confirmAction = null;
  pickingHero = false;
  lastRenderedNodeId = null;
}

export function resetCampScreenState(): void {
  resetTransientState();
}

export function getCampState(run: RunState): CampNodeState {
  const nodeId = run.mapState.currentNodeId;
  run.campStates[nodeId] ??= { used: [], outcomes: [] };
  return run.campStates[nodeId];
}

function recoveryUsed(campState: CampNodeState): boolean {
  for (const a of campState.used) if (RECOVERY_ACTIONS.has(a)) return true;
  return false;
}

export class CampScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  private resetTransientStateForNode(): void {
    const run = gameState.run;
    if (!run) {
      resetTransientState();
      return;
    }
    const nodeId = run.mapState.currentNodeId;
    if (nodeId !== lastRenderedNodeId) {
      phase = "menu";
      confirmAction = null;
      pickingHero = false;
      lastRenderedNodeId = nodeId;
    }
  }

  render(): HTMLElement {
    this.resetTransientStateForNode();

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:16px;max-width:600px;margin:0 auto;";

    const title = document.createElement("h2");
    title.textContent = "Safe Clearing — Camp";
    container.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = "A sheltered spot to rest and recover. Take your time, then move on.";
    desc.style.cssText = "color:#aaa;font-size:14px;text-align:center;";
    container.appendChild(desc);

    if (pickingHero) {
      container.appendChild(this.renderHeroPicker());
      return container;
    }

    if (phase === "confirm" && confirmAction) {
      container.appendChild(this.renderConfirm(confirmAction));
      return container;
    }

    container.appendChild(this.renderMenu());
    return container;
  }

  /** A small log of everything the party has done at this camp, plus a bag summary. */
  private renderStatus(): HTMLElement {
    const run = gameState.run!;
    const campState = getCampState(run);
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:8px;width:320px;";

    if (campState.outcomes.length > 0) {
      const log = document.createElement("div");
      log.style.cssText = "background:#1c1c1c;border:1px solid #333;border-radius:6px;padding:8px 12px;font-size:13px;color:#4f4;";
      const head = document.createElement("div");
      head.textContent = "Camp Log";
      head.style.cssText = "color:#9c9;font-weight:bold;margin-bottom:4px;";
      log.appendChild(head);
      for (const line of campState.outcomes) {
        const row = document.createElement("div");
        row.textContent = `• ${line}`;
        log.appendChild(row);
      }
      wrap.appendChild(log);
    }

    // Bag summary so a brewed potion is visibly confirmed in inventory (acceptance addendum).
    const bag = document.createElement("div");
    bag.style.cssText = "font-size:12px;color:#bbb;text-align:center;";
    const potionNames =
      run.inventory.potions.map((id) => POTION_REGISTRY[id]?.displayName ?? id).join(", ") || "(none)";
    bag.textContent = `Gold: ${run.gold} — Potions: ${potionNames}`;
    wrap.appendChild(bag);

    return wrap;
  }

  private renderMenu(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:12px;";

    wrap.appendChild(this.renderStatus());

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:10px;";

    // Rest (recovery)
    buttons.appendChild(this.actionButton("rest", "Rest (Heal 40% max HP)", this.disabledReason("rest")));
    // Train (not recovery; opens hero picker)
    buttons.appendChild(this.actionButton("train", `Train (+${TRAIN_XP} XP to a hero)`, this.disabledReason("train")));
    // Brew Potion (recovery)
    buttons.appendChild(
      this.actionButton("brew", `Brew Potion (Spend ${CAMP_BREW_POTION_COST} gold → +1 Healing Potion)`, this.disabledReason("brew")),
    );
    // Prepare for Combat (not recovery)
    buttons.appendChild(this.actionButton("prepare", "Prepare for Combat (Bless the party next battle)", this.disabledReason("prepare")));

    wrap.appendChild(buttons);

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave";
    leaveBtn.style.cssText = "padding:10px 24px;font-size:14px;width:300px;margin-top:6px;";
    leaveBtn.addEventListener("click", () => {
      const r = gameState.run;
      if (r) r.mapState.nodesCleared++;
      // Route through the level-up screen first if Train queued any choices (F29).
      routeAfterXp("map");
      this.app.render();
    });
    wrap.appendChild(leaveBtn);

    return wrap;
  }

  /** Returns a disabled reason for a choice, or null when it is available. */
  private disabledReason(action: CampAction): string | null {
    const r = gameState.run!;
    const campState = getCampState(r);
    if (campState.used.includes(action)) return "Already done at this camp.";
    if (RECOVERY_ACTIONS.has(action) && recoveryUsed(campState)) return "Already recovered at this camp.";
    if (action === "brew" && r.gold < CAMP_BREW_POTION_COST) return `Requires ${CAMP_BREW_POTION_COST} gold.`;
    if (action === "train" && !r.party.some((p) => p.hp > 0)) return "Requires a living hero.";
    return null;
  }

  private actionButton(action: CampAction, label: string, reason: string | null): HTMLElement {
    const btn = document.createElement("button");
    btn.style.cssText = "padding:10px 24px;font-size:14px;width:300px;";
    if (reason) {
      btn.disabled = true;
      btn.textContent = `${label} — ${reason}`;
      btn.style.opacity = "0.5";
      return btn;
    }
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (action === "train") {
        pickingHero = true;
      } else {
        confirmAction = action;
        phase = "confirm";
      }
      this.app.render();
    });
    return btn;
  }

  /** Pre-confirm preview: shows the exact effect/tradeoff and stays reversible via Cancel. */
  private renderConfirm(action: CampAction): HTMLElement {
    const run = gameState.run!;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:12px;";

    const preview = document.createElement("div");
    preview.style.cssText = "font-size:15px;color:#ddd;text-align:center;max-width:380px;";

    if (action === "rest") {
      const lines = run.party
        .filter((p) => p.hp > 0)
        .map((p) => {
          const heal = Math.max(1, Math.floor(p.maxHp * 0.4));
          const after = Math.min(p.maxHp, p.hp + heal);
          return `${p.displayName}: ${p.hp} → ${after} HP`;
        });
      preview.innerHTML = `<b>Rest</b><br/>Heal each living hero 40% of max HP.<br/><span style="font-size:13px;color:#bbb;">${lines.join("<br/>")}</span>`;
    } else if (action === "brew") {
      preview.innerHTML = `<b>Brew Potion</b><br/>Spend ${CAMP_BREW_POTION_COST} gold (you have ${run.gold}) to add 1 Healing Potion to your bag.`;
    } else if (action === "prepare") {
      preview.innerHTML = `<b>Prepare for Combat</b><br/>The party is Blessed (+2 to each hero's first attack or heal) at the start of the next battle. The blessing is saved until your next fight.`;
    }
    wrap.appendChild(preview);

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm";
    confirmBtn.style.cssText = "padding:10px 28px;font-size:14px;width:160px;";
    confirmBtn.addEventListener("click", () => {
      this.applyAction(action);
      phase = "menu";
      confirmAction = null;
      this.app.render();
    });
    wrap.appendChild(confirmBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 24px;font-size:13px;width:160px;";
    cancelBtn.addEventListener("click", () => {
      phase = "menu";
      confirmAction = null;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }

  private applyAction(action: CampAction): void {
    const run = gameState.run!;
    const campState = getCampState(run);
    if (action === "rest") {
      const before = run.party.map((p) => p.hp);
      restParty(run.party);
      const messages = run.party.map((p, i) => `${p.displayName}: ${before[i]} → ${p.hp} HP`);
      campState.outcomes.push(`Party rested! ${messages.join(", ")}`);
      this.markUsed(campState, "rest");
    } else if (action === "brew") {
      const result = brewPotion(run);
      campState.outcomes.push(result.message);
      if (result.ok) this.markUsed(campState, "brew");
    } else if (action === "prepare") {
      const result = prepareForCombat(run);
      campState.outcomes.push(result.message);
      this.markUsed(campState, "prepare");
    }
  }

  private markUsed(campState: CampNodeState, action: CampAction): void {
    if (!campState.used.includes(action)) campState.used.push(action);
  }

  private renderHeroPicker(): HTMLElement {
    const run = gameState.run!;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;";

    const label = document.createElement("div");
    label.textContent = "Choose a hero to train:";
    label.style.cssText = "font-size:16px;margin-bottom:8px;";
    wrap.appendChild(label);

    for (const pm of run.party) {
      const btn = document.createElement("button");
      const classDef = CLASS_REGISTRY[pm.classId];
      btn.textContent = `${classDef?.displayName ?? pm.classId} — ${pm.displayName} (Lv.${pm.level} ${pm.xp} XP)`;
      btn.style.cssText = "padding:8px 16px;font-size:13px;width:320px;";
      btn.addEventListener("click", () => {
        const campState = getCampState(run);
        const result = trainPartyMember(pm, TRAIN_XP);
        let msg = `${pm.displayName} gains ${TRAIN_XP} XP (now ${pm.xp} XP).`;
        if (result.leveledUp) {
          msg += ` Reaches Level ${result.newLevel}!`;
          enqueuePendingLevelUps(gameState.pendingLevelUps, pm.instanceId, pm.classId, result.levelsGained);
        }
        campState.outcomes.push(msg);
        this.markUsed(campState, "train");
        pickingHero = false;
        this.app.render();
      });
      wrap.appendChild(btn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:8px 16px;font-size:13px;margin-top:8px;";
    cancelBtn.addEventListener("click", () => {
      pickingHero = false;
      this.app.render();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
  }
}
