import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import type { Difficulty, PartyMember } from "../../state/RunState.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { ACTION_REGISTRY } from "../../data/actions.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import {
  defaultPartySpecs,
  validatePartySetup,
  buildParty,
  createRunState,
  RUN_SETUP_PARTY_SIZE,
} from "../../run/PartySetup.ts";
import type { PartySpec } from "../../run/PartySetup.ts";
import {
  applyMetaUpgradesToFreshRun,
  getAmbiguousClassUpgrades,
} from "../../meta/Upgrades.ts";
import type { AmbiguousClassUpgrade } from "../../meta/Upgrades.ts";
import { applyBackgrounds } from "../../run/Backgrounds.ts";
import { BACKGROUND_REGISTRY, describeBackgroundEffect } from "../../data/backgrounds.ts";

// Module-level state persists across SetupScreen instances created by App.render().
let specs: PartySpec[] = [];
let difficulty: Difficulty = "normal";
let phase: "edit" | "assign" = "edit";
let pendingParty: PartyMember[] | null = null;
let ambiguous: AmbiguousClassUpgrade[] = [];
let assignments: Record<string, string> = {};
let initialized = false;

/** Re-seed the setup screen with pre-filled defaults. Called when entering from the menu. */
export function resetSetupScreenState(diff: Difficulty = "normal"): void {
  specs = defaultPartySpecs();
  difficulty = diff;
  phase = "edit";
  pendingParty = null;
  ambiguous = [];
  assignments = {};
  initialized = true;
}

const CLASS_IDS = Object.keys(CLASS_REGISTRY);

export class SetupScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  render(): HTMLElement {
    if (!initialized) resetSetupScreenState();

    const container = document.createElement("div");
    container.style.cssText =
      "display:flex;flex-direction:column;align-items:center;padding:32px 20px;gap:16px;max-width:760px;margin:0 auto;";

    if (phase === "assign") {
      return this.renderAssignPhase(container);
    }
    return this.renderEditPhase(container);
  }

  private renderEditPhase(container: HTMLElement): HTMLElement {
    const title = document.createElement("h2");
    title.textContent = "Assemble Your Party";
    container.appendChild(title);

    const sub = document.createElement("div");
    sub.textContent = `Choose ${RUN_SETUP_PARTY_SIZE} heroes. Duplicate classes are allowed.`;
    sub.style.cssText = "color:#aaa;font-size:13px;";
    container.appendChild(sub);

    // Difficulty control (mirrored from the main menu, owned by setup going forward).
    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex;gap:8px;align-items:center;";
    const diffLabel = document.createElement("span");
    diffLabel.style.cssText = "font-size:14px;";
    diffLabel.textContent = "Difficulty:";
    diffRow.appendChild(diffLabel);
    const diffBtn = document.createElement("button");
    diffBtn.style.cssText = "padding:4px 12px;font-size:13px;min-width:80px;";
    const paintDiff = () => {
      diffBtn.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      diffBtn.style.color = difficulty === "hard" ? "#f44" : "#fff";
    };
    paintDiff();
    diffBtn.addEventListener("click", () => {
      difficulty = difficulty === "normal" ? "hard" : "normal";
      paintDiff();
    });
    diffRow.appendChild(diffBtn);
    container.appendChild(diffRow);

    // Validation surfaces — refreshed live on name edits without a full re-render.
    const confirmBtn = document.createElement("button");
    const reasonEl = document.createElement("div");
    reasonEl.style.cssText = "color:#f80;font-size:13px;min-height:16px;";
    const slotErrorEls: HTMLElement[] = [];

    const refreshValidation = () => {
      const v = validatePartySetup(specs);
      confirmBtn.disabled = !v.ok;
      confirmBtn.style.opacity = v.ok ? "1" : "0.5";
      confirmBtn.style.cursor = v.ok ? "pointer" : "not-allowed";
      reasonEl.textContent = v.ok ? "" : `Cannot start: ${v.reason}`;
      v.slotErrors.forEach((err, i) => {
        const el = slotErrorEls[i];
        if (el) el.textContent = err ?? "";
      });
    };

    specs.forEach((spec, i) => {
      const { row, errorEl } = this.renderSlot(spec, i, refreshValidation);
      slotErrorEls[i] = errorEl;
      container.appendChild(row);
    });

    container.appendChild(reasonEl);

    confirmBtn.textContent = "Confirm Party";
    confirmBtn.style.cssText = "padding:10px 28px;font-size:16px;";
    confirmBtn.addEventListener("click", () => this.onConfirm());
    container.appendChild(confirmBtn);

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.cssText = "padding:8px 20px;font-size:13px;";
    backBtn.addEventListener("click", () => {
      initialized = false;
      gameState.screen = "main_menu";
      this.app.render();
    });
    container.appendChild(backBtn);

    refreshValidation();
    return container;
  }

  private renderSlot(
    spec: PartySpec,
    index: number,
    refreshValidation: () => void,
  ): { row: HTMLElement; errorEl: HTMLElement } {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;flex-direction:column;gap:8px;border:1px solid #444;border-radius:6px;padding:12px;width:100%;box-sizing:border-box;";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;gap:12px;align-items:center;flex-wrap:wrap;";

    const slotLabel = document.createElement("span");
    slotLabel.textContent = `Hero ${index + 1}`;
    slotLabel.style.cssText = "font-weight:bold;font-size:14px;min-width:60px;";
    header.appendChild(slotLabel);

    // Class selector — changing class rebuilds the preview, so a full re-render is fine.
    const classSelect = document.createElement("select");
    classSelect.style.cssText = "padding:4px 8px;font-size:13px;";
    for (const classId of CLASS_IDS) {
      const opt = document.createElement("option");
      opt.value = classId;
      opt.textContent = CLASS_REGISTRY[classId].displayName;
      if (classId === spec.classId) opt.selected = true;
      classSelect.appendChild(opt);
    }
    classSelect.addEventListener("change", () => {
      specs[index].classId = classSelect.value;
      this.app.render();
    });
    header.appendChild(classSelect);

    // Name input — updates state live without re-rendering (preserves focus while typing).
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = spec.name;
    nameInput.placeholder = "Hero name";
    nameInput.style.cssText = "padding:4px 8px;font-size:13px;flex:1;min-width:120px;";
    nameInput.addEventListener("input", () => {
      specs[index].name = nameInput.value;
      refreshValidation();
    });
    header.appendChild(nameInput);

    row.appendChild(header);

    row.appendChild(this.renderBackgroundPicker(spec, index));

    const errorEl = document.createElement("div");
    errorEl.style.cssText = "color:#f66;font-size:12px;min-height:14px;";
    row.appendChild(errorEl);

    row.appendChild(this.renderClassPreview(spec.classId));

    return { row, errorEl };
  }

  /** Per-slot background dropdown: name + effect, reversible until Confirm, "none" allowed. */
  private renderBackgroundPicker(spec: PartySpec, index: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";

    const label = document.createElement("span");
    label.textContent = "Background:";
    label.style.cssText = "font-size:13px;color:#bbb;";
    wrap.appendChild(label);

    const select = document.createElement("select");
    select.style.cssText = "padding:4px 8px;font-size:13px;";

    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "None";
    if (!spec.backgroundId) noneOpt.selected = true;
    select.appendChild(noneOpt);

    for (const bg of Object.values(BACKGROUND_REGISTRY)) {
      const opt = document.createElement("option");
      opt.value = bg.id;
      opt.textContent = bg.displayName;
      if (bg.id === spec.backgroundId) opt.selected = true;
      select.appendChild(opt);
    }

    const effectEl = document.createElement("span");
    effectEl.style.cssText = "font-size:12px;color:#8c8;";
    const paintEffect = () => {
      const bg = spec.backgroundId ? BACKGROUND_REGISTRY[spec.backgroundId] : undefined;
      effectEl.textContent = bg ? `${describeBackgroundEffect(bg)} — ${bg.flavor}` : "";
    };
    paintEffect();

    select.addEventListener("change", () => {
      specs[index].backgroundId = select.value === "" ? null : select.value;
      paintEffect();
    });

    wrap.appendChild(select);
    wrap.appendChild(effectEl);
    return wrap;
  }

  private renderClassPreview(classId: string): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.cssText = "font-size:12px;color:#bbb;display:flex;flex-direction:column;gap:3px;";

    const def = CLASS_REGISTRY[classId];
    if (!def) {
      wrap.textContent = "Unknown class.";
      return wrap;
    }

    const role = document.createElement("div");
    role.innerHTML = `<span style="color:#fff;font-weight:bold;">${def.displayName}</span>`;
    wrap.appendChild(role);

    const s = def.baseStats;
    const stats = document.createElement("div");
    stats.textContent = `HP ${s.maxHp} · Armor ${s.armor} · Move ${s.move} · Might ${s.might} · Agility ${s.agility} · Spirit ${s.spirit}`;
    wrap.appendChild(stats);

    const actionNames = def.actionIds.map((id) => ACTION_REGISTRY[id]?.displayName ?? id);
    const actions = document.createElement("div");
    actions.textContent = `Actions: ${actionNames.join(", ")}`;
    wrap.appendChild(actions);

    const gearNames = (def.startingItems ?? []).map((id) => ITEM_REGISTRY[id]?.displayName ?? id);
    const gear = document.createElement("div");
    gear.textContent = `Starting gear: ${gearNames.length ? gearNames.join(", ") : "None"}`;
    wrap.appendChild(gear);

    return wrap;
  }

  private onConfirm(): void {
    const v = validatePartySetup(specs);
    if (!v.ok) return;

    const party = buildParty(specs);
    const amb = getAmbiguousClassUpgrades(party, gameState.meta);
    if (amb.length > 0) {
      pendingParty = party;
      ambiguous = amb;
      assignments = {};
      for (const a of amb) assignments[a.upgradeId] = a.candidates[0].instanceId;
      phase = "assign";
      this.app.render();
      return;
    }

    this.startRun(party, {});
  }

  private startRun(party: PartyMember[], targetAssignments: Record<string, string>): void {
    const run = createRunState(party, difficulty);
    applyBackgrounds(run);
    applyMetaUpgradesToFreshRun(run, gameState.meta, targetAssignments);
    gameState.run = run;
    gameState.combat = null;
    gameState.screen = "map";
    initialized = false;
    this.app.render();
  }

  private renderAssignPhase(container: HTMLElement): HTMLElement {
    const title = document.createElement("h2");
    title.textContent = "Assign Upgrade Targets";
    container.appendChild(title);

    const sub = document.createElement("div");
    sub.textContent =
      "These meta upgrades could apply to more than one hero of the same class. Pick who receives each.";
    sub.style.cssText = "color:#aaa;font-size:13px;text-align:center;";
    container.appendChild(sub);

    for (const amb of ambiguous) {
      const block = document.createElement("div");
      block.style.cssText =
        "display:flex;flex-direction:column;gap:6px;border:1px solid #444;border-radius:6px;padding:12px;width:100%;box-sizing:border-box;";

      const label = document.createElement("div");
      label.innerHTML = `<span style="color:#fff;font-weight:bold;">${amb.def.displayName}</span> — ${amb.def.description}`;
      label.style.cssText = "font-size:13px;";
      block.appendChild(label);

      const choices = document.createElement("div");
      choices.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
      const paint = () => {
        for (const child of Array.from(choices.children) as HTMLButtonElement[]) {
          const selected = child.dataset.instanceId === assignments[amb.upgradeId];
          child.style.borderColor = selected ? "#4f4" : "#666";
          child.style.color = selected ? "#4f4" : "#fff";
        }
      };
      for (const cand of amb.candidates) {
        const btn = document.createElement("button");
        btn.dataset.instanceId = cand.instanceId;
        btn.textContent = `${cand.displayName} (${CLASS_REGISTRY[cand.classId]?.displayName ?? cand.classId})`;
        btn.style.cssText = "padding:6px 14px;font-size:13px;border:2px solid #666;";
        btn.addEventListener("click", () => {
          assignments[amb.upgradeId] = cand.instanceId;
          paint();
        });
        choices.appendChild(btn);
      }
      paint();
      block.appendChild(choices);
      container.appendChild(block);
    }

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start Run";
    startBtn.style.cssText = "padding:10px 28px;font-size:16px;";
    startBtn.addEventListener("click", () => {
      if (pendingParty) this.startRun(pendingParty, assignments);
    });
    container.appendChild(startBtn);

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.cssText = "padding:8px 20px;font-size:13px;";
    backBtn.addEventListener("click", () => {
      phase = "edit";
      pendingParty = null;
      ambiguous = [];
      this.app.render();
    });
    container.appendChild(backBtn);

    return container;
  }
}
