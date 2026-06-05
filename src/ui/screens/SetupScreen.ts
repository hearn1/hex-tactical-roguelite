import type { App } from "../App.ts";
import { gameState, reseedRngFromRun } from "../../state/GameState.ts";
import type { Difficulty, PartyMember } from "../../state/RunState.ts";
import type { UnitInstance } from "../../state/types.ts";
import { CLASS_REGISTRY } from "../../data/classes.ts";
import { ACTION_REGISTRY } from "../../data/actions.ts";
import { ITEM_REGISTRY } from "../../data/items.ts";
import { createRng } from "../../core/rng.ts";
import {
  defaultPartySpecs,
  validatePartySetup,
  buildParty,
  createRunState,
  RUN_SETUP_PARTY_SIZE,
} from "../../run/PartySetup.ts";
import type { PartySpec } from "../../run/PartySetup.ts";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  abilityMod,
  rollAbilityScores,
} from "../../data/abilities.ts";
import type { AbilityKey, AbilityRoll, AbilityScores } from "../../data/abilities.ts";
import { computeStats } from "../../combat/Stats.ts";
import {
  applyMetaUpgradesToFreshRun,
  getAmbiguousClassUpgrades,
} from "../../meta/Upgrades.ts";
import type { AmbiguousClassUpgrade } from "../../meta/Upgrades.ts";
import { applyBackgrounds } from "../../run/Backgrounds.ts";
import { BACKGROUND_REGISTRY, describeBackgroundEffect } from "../../data/backgrounds.ts";
import { generateModifierOffers, applyAdventureModifier, ADVENTURE_MODIFIER_REGISTRY } from "../../data/adventureModifiers.ts";

// Module-level state persists across SetupScreen instances created by App.render().
let specs: PartySpec[] = [];
let difficulty: Difficulty = "normal";
let phase: "edit" | "assign" = "edit";
let pendingParty: PartyMember[] | null = null;
let ambiguous: AmbiguousClassUpgrade[] = [];
let assignments: Record<string, string> = {};
let initialized = false;

// Adventure modifier + seed state
let seedInput: string = "";
let modifierOffers: string[] = [];
let chosenModifierId: string | null = null;
let setupRollRng: () => number = createRng(Date.now());
let abilityRollPools: Record<number, AbilityRoll[]> = {};
let abilityAssignments: Record<number, Partial<Record<AbilityKey, number>>> = {};

function parseSetupSeed(): number {
  return parseInt(seedInput, 10) || Date.now();
}

function resetAbilityRollState(): void {
  setupRollRng = createRng(parseSetupSeed());
  abilityRollPools = {};
  abilityAssignments = {};
}

function formatAbilityMod(score: number): string {
  const mod = abilityMod(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatRoll(roll: AbilityRoll, index: number): string {
  return `#${index + 1} ${roll.total} [${roll.dice.join(", ")} drop ${roll.dropped}]`;
}

function syncAssignedAbilityScores(index: number): void {
  const rolls = abilityRollPools[index];
  const assigned = abilityAssignments[index] ?? {};
  if (!rolls || !ABILITY_KEYS.every((key) => assigned[key] !== undefined)) {
    specs[index].abilityScores = undefined;
    return;
  }

  const next: Partial<AbilityScores> = {};
  for (const key of ABILITY_KEYS) {
    const rollIndex = assigned[key];
    if (rollIndex === undefined || !rolls[rollIndex]) {
      specs[index].abilityScores = undefined;
      return;
    }
    next[key] = rolls[rollIndex].total;
  }
  specs[index].abilityScores = next as AbilityScores;
}

/** Re-seed the setup screen with pre-filled defaults. Called when entering from the menu. */
export function resetSetupScreenState(diff: Difficulty = "normal"): void {
  specs = defaultPartySpecs();
  difficulty = diff;
  phase = "edit";
  pendingParty = null;
  ambiguous = [];
  assignments = {};
  seedInput = String(Date.now());
  chosenModifierId = null;
  resetAbilityRollState();
  // Generate offers from the seed once setup screen state is reset
  const seed = parseSetupSeed();
  modifierOffers = generateModifierOffers(seed, 3);
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

    // Seed input row
    const seedRow = document.createElement("div");
    seedRow.style.cssText = "display:flex;gap:8px;align-items:center;width:100%;max-width:500px;";
    const seedLabel = document.createElement("span");
    seedLabel.style.cssText = "font-size:13px;color:#bbb;";
    seedLabel.textContent = "Run Seed:";
    seedRow.appendChild(seedLabel);
    const seedField = document.createElement("input");
    seedField.type = "text";
    seedField.value = seedInput;
    seedField.style.cssText = "padding:4px 8px;font-size:13px;flex:1;min-width:100px;font-family:monospace;";
    seedField.addEventListener("input", () => {
      seedInput = seedField.value;
      const seed = parseSetupSeed();
      modifierOffers = generateModifierOffers(seed, 3);
      chosenModifierId = null;
      setupRollRng = createRng(seed);
      this.renderModifierSection();
    });
    seedRow.appendChild(seedField);
    container.appendChild(seedRow);

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

    // Modifier selection section
    const modSection = document.createElement("div");
    modSection.id = "modifier-section";
    modSection.style.cssText = "width:100%;max-width:600px;";
    container.appendChild(modSection);

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
    this.renderModifierSection();
    return container;
  }

  private renderModifierSection(): void {
    const section = document.getElementById("modifier-section");
    if (!section) return;
    section.innerHTML = "";

    const modLabel = document.createElement("div");
    modLabel.style.cssText = "font-size:14px;font-weight:bold;color:#ddd;margin-top:8px;";
    modLabel.textContent = "Adventure Modifier (choose one or None):";
    section.appendChild(modLabel);

    const cardRow = document.createElement("div");
    cardRow.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px;";

    const paintCards = () => {
      for (const child of Array.from(cardRow.children) as HTMLElement[]) {
        const modId = child.dataset.modifierId ?? "";
        const selected = chosenModifierId === modId;
        (child as HTMLElement).style.borderColor = selected ? "#4f4" : "#555";
        (child as HTMLElement).style.background = selected ? "#2a4a2a" : "#2a2a2a";
      }
    };

    for (const modId of modifierOffers) {
      const def = ADVENTURE_MODIFIER_REGISTRY[modId];
      if (!def) continue;
      const card = document.createElement("div");
      card.dataset.modifierId = modId;
      card.style.cssText = "border:2px solid #555;border-radius:8px;padding:12px;cursor:pointer;background:#2a2a2a;text-align:center;min-width:160px;max-width:180px;";
      card.innerHTML = `
        <div style="font-weight:bold;color:#8cf;font-size:14px;">${def.displayName}</div>
        <div style="font-size:11px;color:#8c8;margin-top:6px;">${def.bonusDescription}</div>
        <div style="font-size:11px;color:#c88;margin-top:2px;">${def.drawbackDescription}</div>
      `;
      card.addEventListener("click", () => {
        chosenModifierId = modId;
        paintCards();
      });
      cardRow.appendChild(card);
    }

    // None option
    const noneCard = document.createElement("div");
    noneCard.dataset.modifierId = "";
    noneCard.style.cssText = "border:2px solid #555;border-radius:8px;padding:12px;cursor:pointer;background:#2a2a2a;text-align:center;min-width:160px;max-width:180px;";
    noneCard.innerHTML = `<div style="font-weight:bold;color:#aaa;font-size:14px;">None</div><div style="font-size:11px;color:#888;margin-top:6px;">No modifier — standard run</div>`;
    noneCard.addEventListener("click", () => {
      chosenModifierId = null;
      paintCards();
    });
    cardRow.appendChild(noneCard);

    section.appendChild(cardRow);
    paintCards();
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
    row.appendChild(this.renderAbilityScores(spec, index));

    const errorEl = document.createElement("div");
    errorEl.style.cssText = "color:#f66;font-size:12px;min-height:14px;";
    row.appendChild(errorEl);

    row.appendChild(this.renderClassPreview(spec.classId, spec.abilityScores));

    return { row, errorEl };
  }

  private renderAbilityScores(spec: PartySpec, index: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex;flex-direction:column;gap:8px;border-top:1px solid #333;padding-top:8px;";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;";

    const label = document.createElement("span");
    label.textContent = "Ability Scores";
    label.style.cssText = "font-size:13px;color:#ddd;font-weight:bold;";
    header.appendChild(label);

    const rollBtn = document.createElement("button");
    rollBtn.textContent = "Roll 4d6 Drop Lowest";
    rollBtn.style.cssText = "padding:5px 10px;font-size:12px;";
    rollBtn.addEventListener("click", () => {
      abilityRollPools[index] = rollAbilityScores(setupRollRng);
      abilityAssignments[index] = {};
      specs[index].abilityScores = undefined;
      this.app.render();
    });
    header.appendChild(rollBtn);
    wrap.appendChild(header);

    const scoreLine = document.createElement("div");
    scoreLine.style.cssText = "font-size:12px;color:#bbb;display:flex;gap:8px;flex-wrap:wrap;";
    if (spec.abilityScores) {
      for (const key of ABILITY_KEYS) {
        const chip = document.createElement("span");
        const score = spec.abilityScores[key];
        chip.textContent = `${ABILITY_LABELS[key]} ${score} (${formatAbilityMod(score)})`;
        chip.style.cssText = "padding:2px 6px;border:1px solid #444;border-radius:4px;background:#202020;";
        scoreLine.appendChild(chip);
      }
    } else {
      scoreLine.textContent = "Unassigned";
      scoreLine.style.color = "#f80";
    }
    wrap.appendChild(scoreLine);

    const rolls = abilityRollPools[index];
    if (!rolls) return wrap;

    const rollLine = document.createElement("div");
    rollLine.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    rolls.forEach((roll, rollIndex) => {
      const pill = document.createElement("span");
      pill.textContent = formatRoll(roll, rollIndex);
      pill.style.cssText = "font-size:11px;color:#ccc;border:1px solid #555;border-radius:4px;padding:2px 5px;";
      rollLine.appendChild(pill);
    });
    wrap.appendChild(rollLine);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:6px;";

    const assigned = abilityAssignments[index] ?? {};
    const usedRolls = new Set<number>(
      Object.values(assigned).filter((rollIndex): rollIndex is number => rollIndex !== undefined),
    );

    for (const key of ABILITY_KEYS) {
      const cell = document.createElement("label");
      cell.style.cssText = "display:flex;gap:5px;align-items:center;font-size:12px;color:#bbb;";

      const text = document.createElement("span");
      text.textContent = ABILITY_LABELS[key];
      text.style.cssText = "width:28px;color:#ddd;font-weight:bold;";
      cell.appendChild(text);

      const select = document.createElement("select");
      select.style.cssText = "flex:1;min-width:72px;padding:3px 5px;font-size:12px;";

      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "--";
      select.appendChild(blank);

      rolls.forEach((roll, rollIndex) => {
        const opt = document.createElement("option");
        opt.value = String(rollIndex);
        opt.textContent = `${roll.total}`;
        opt.disabled = usedRolls.has(rollIndex) && assigned[key] !== rollIndex;
        if (assigned[key] === rollIndex) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => {
        abilityAssignments[index] = { ...(abilityAssignments[index] ?? {}) };
        if (select.value === "") {
          delete abilityAssignments[index][key];
        } else {
          abilityAssignments[index][key] = Number(select.value);
        }
        syncAssignedAbilityScores(index);
        this.app.render();
      });

      cell.appendChild(select);
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);

    return wrap;
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

  private renderClassPreview(classId: string, abilityScores?: AbilityScores): HTMLElement {
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

    const previewStats = this.computePreviewStats(classId, abilityScores);
    const preview = document.createElement("div");
    preview.textContent = `Preview: HP ${previewStats.maxHp} | Armor ${previewStats.armor} | Move ${previewStats.move} | Might ${previewStats.might} | Agility ${previewStats.agility} | Spirit ${previewStats.spirit}`;
    preview.style.color = abilityScores ? "#8c8" : "#aaa";
    wrap.appendChild(preview);

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

  private computePreviewStats(classId: string, abilityScores?: AbilityScores) {
    const def = CLASS_REGISTRY[classId];
    const equippedItemIds: UnitInstance["equippedItemIds"] = { weapon: null, armor: null, trinket: null };
    for (const itemId of def?.startingItems ?? []) {
      const item = ITEM_REGISTRY[itemId];
      if (!item) continue;
      if (!equippedItemIds[item.slot]) equippedItemIds[item.slot] = itemId;
    }

    const unit: UnitInstance = {
      instanceId: "preview",
      defId: classId,
      displayName: "Preview",
      team: "hero",
      level: 1,
      xp: 0,
      stats: { ...def.baseStats },
      hp: def.baseStats.maxHp,
      pos: { q: 0, r: 0 },
      conditions: [],
      movePointsRemaining: 0,
      hasActed: false,
      equippedItemIds,
      bonusStats: {},
      abilityScores,
    };
    return computeStats(unit);
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
    const seed = parseSetupSeed();
    const run = createRunState(party, difficulty);
    run.seed = seed;

    if (chosenModifierId) {
      run.adventureModifierId = chosenModifierId;
      applyAdventureModifier(run, chosenModifierId);
      const def = ADVENTURE_MODIFIER_REGISTRY[chosenModifierId];
      if (def?.startingGoldDelta) {
        run.gold = Math.max(0, run.gold + def.startingGoldDelta);
        run.inventory.gold = run.gold;
      }
      if (def?.startingPotionId) {
        run.inventory.potions.push(def.startingPotionId);
      }
    }

    applyBackgrounds(run);
    applyMetaUpgradesToFreshRun(run, gameState.meta, targetAssignments);
    reseedRngFromRun(run.seed);
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
