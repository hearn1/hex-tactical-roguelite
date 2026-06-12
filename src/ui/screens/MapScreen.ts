import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { NODE_REGISTRY, getMapTemplate, resolveNodeEncounterId } from "../../data/nodes.ts";
import type { NodeDef, MapTemplate } from "../../data/nodes.ts";
import { availableNextNodes, visitNode } from "../../run/MapGraph.ts";
import { createCombatFromRun } from "../../state/GameState.ts";
import { ADVENTURE_MODIFIER_REGISTRY } from "../../data/adventureModifiers.ts";
import {
  applyShortRest,
  canAnyHeroSpendHitDice,
  ensureRunRestState,
  shortRestsRemaining,
} from "../../run/Rest.ts";
import { appendAdventureLogOnce, ensureAdventureLog } from "../../run/AdventureLog.ts";
import {
  lookupStoryText,
  getCampaignStartHookId,
} from "../../data/storyText.ts";

const LAYER_COLORS: Record<string, string> = {
  start: "#4a8",
  combat: "#c44",
  elite: "#c84",
  boss: "#f22",
  shop: "#48c",
  camp: "#4a4",
  event: "#ca4",
  recruit: "#8c4",
  side_route_start: "#2ac",
  side_route_node: "#2ac",
  side_route_return: "#2ac",
};

const NODE_RADIUS = 28;
let shortRestMessage = "";
let showAdventureLog = false;

function buildLayers(nodes: NodeDef[]): NodeDef[][] {
  const layers: NodeDef[][] = [];
  for (const node of nodes) {
    while (layers.length <= node.layer) layers.push([]);
    layers[node.layer].push(node);
  }
  return layers;
}

export class MapScreen {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** Small legend so the player can read node type (and risk) before choosing a route. */
  private buildLegend(): HTMLElement {
    const legend = document.createElement("div");
    legend.style.cssText =
      "display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;font-size:11px;color:#bbb;align-items:center;";
    const entries: { type: string; label: string }[] = [
      { type: "combat", label: "Combat" },
      { type: "elite", label: "Elite (high risk)" },
      { type: "shop", label: "Shop" },
      { type: "camp", label: "Camp (rest)" },
      { type: "event", label: "Event" },
      { type: "recruit", label: "Recruit" },
      { type: "boss", label: "Boss" },
      { type: "side_route_start", label: "Side Quest (dashed = optional)" },
    ];
    for (const entry of entries) {
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;";
      const swatch = document.createElement("span");
      swatch.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${LAYER_COLORS[entry.type] ?? "#888"};`;
      chip.appendChild(swatch);
      chip.appendChild(document.createTextNode(entry.label));
      legend.appendChild(chip);
    }
    return legend;
  }

  render(): HTMLElement {
    // If returning from combat mid-side-quest, hand off to the side quest screen.
    {
      const currentNode = gameState.run
        ? NODE_REGISTRY[gameState.run.mapState.currentNodeId]
        : undefined;
      if (
        currentNode?.type === "side_route_node" ||
        currentNode?.type === "side_route_return"
      ) {
        gameState.screen = "side_quest_node";
        this.app.render();
        return document.createElement("div");
      }
    }

    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:20px;";

    const template: MapTemplate = getMapTemplate(gameState.run!.mapTemplateId);

    const title = document.createElement("h2");
    title.textContent = template.name;
    container.appendChild(title);

    const campaign = gameState.campaign;
    const currentRun = gameState.run;
    const isCampaignStart =
      campaign != null &&
      currentRun != null &&
      campaign.currentActNumber === 1 &&
      currentRun.mapState.nodesCleared === 0 &&
      campaign.completedActs.length === 0;

    if (isCampaignStart) {
      const storyBanner = document.createElement("div");
      storyBanner.style.cssText =
        "font-size:14px;color:#ca8;max-width:600px;text-align:center;font-style:italic;line-height:1.6;margin-bottom:8px;padding:8px 12px;border:1px solid #443;border-radius:4px;";
      storyBanner.textContent = lookupStoryText(getCampaignStartHookId(campaign.campaignId));
      container.appendChild(storyBanner);
    }

    container.appendChild(this.buildLegend());

    // Internal side quest nodes (node/return) are navigated via the side quest screen,
    // not the main map. Only the entry (side_route_start) stays visible.
    const HIDDEN_TYPES = new Set(["side_route_node", "side_route_return"]);
    const visibleNodes = template.nodes.filter((n) => !HIDDEN_TYPES.has(n.type));
    const hiddenNodeIds = new Set(
      template.nodes.filter((n) => HIDDEN_TYPES.has(n.type)).map((n) => n.id),
    );

    const layers = buildLayers(visibleNodes);
    const mapWidth = Math.max(900, (layers.length + 1) * 90);
    const mapHeight = 520;

    const mapEl = document.createElement("div");
    mapEl.style.cssText = `position:relative;width:${mapWidth}px;height:${mapHeight}px;margin-top:10px;overflow-x:auto;`;

    const mapState = gameState.run!.mapState;
    const available = availableNextNodes(mapState);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(mapWidth));
    svg.setAttribute("height", String(mapHeight));
    svg.style.cssText = "position:absolute;top:0;left:0;";

    const nodeCoords: Map<string, { x: number; y: number }> = new Map();

    const layerWidth = (mapWidth - 80) / (layers.length + 1);
    for (let li = 0; li < layers.length; li++) {
      const nodes = layers[li];
      const x = 40 + layerWidth * (li + 1) - layerWidth / 2;
      const spacing = Math.min(110, (mapHeight - 80) / (nodes.length + 1));
      const startY = mapHeight / 2 - (spacing * (nodes.length - 1)) / 2;
      for (let ni = 0; ni < nodes.length; ni++) {
        const y = startY + spacing * ni;
        nodeCoords.set(nodes[ni].id, { x, y });
      }
    }

    for (const node of visibleNodes) {
      for (const nextId of node.nextNodeIds) {
        if (hiddenNodeIds.has(nextId)) continue;
        const from = nodeCoords.get(node.id);
        const to = nodeCoords.get(nextId);
        if (!from || !to) continue;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", String(from.x));
        line.setAttribute("y1", String(from.y));
        line.setAttribute("x2", String(to.x));
        line.setAttribute("y2", String(to.y));
        line.setAttribute("stroke", "#555");
        line.setAttribute("stroke-width", "2");
        svg.appendChild(line);
      }
    }

    for (const node of visibleNodes) {
      const coords = nodeCoords.get(node.id);
      if (!coords) continue;

      const isCurrent = mapState.currentNodeId === node.id;
      const isVisited = mapState.visitedNodeIds.includes(node.id);
      const isAvailable = available.includes(node.id);
      const isLocked = !isVisited && !isAvailable && !isCurrent;
      const isForetold = !!gameState.run?.revealedForecasts?.[node.id];

      const group = document.createElementNS(svgNS, "g");

      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", String(coords.x));
      circle.setAttribute("cy", String(coords.y));
      circle.setAttribute("r", String(NODE_RADIUS));

      let fill = "#333";
      let stroke = "#555";
      let strokeWidth = 2;
      let cursor = "default";

      if (isCurrent) {
        fill = LAYER_COLORS[node.type] ?? "#888";
        stroke = "#fff";
        strokeWidth = 3;
      } else if (isVisited) {
        fill = "#2a2a3a";
        stroke = LAYER_COLORS[node.type] ?? "#555";
        strokeWidth = 1;
      } else if (isAvailable) {
        fill = "#1a2a3a";
        stroke = "#ffcc00";
        strokeWidth = 3;
        cursor = "pointer";
      } else if (isLocked && isForetold) {
        fill = "#1a2a1a";
        stroke = "#8c8";
        strokeWidth = 2;
      } else if (isLocked) {
        fill = "#1a1a1a";
        stroke = "#333";
        strokeWidth = 1;
      }

      const isSideRoute =
        node.type === "side_route_start" ||
        node.type === "side_route_node" ||
        node.type === "side_route_return";
      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", isSideRoute && !isCurrent && !isAvailable ? "#1a7a8a" : stroke);
      circle.setAttribute("stroke-width", String(strokeWidth));
      circle.setAttribute("stroke-dasharray", isSideRoute && !isCurrent ? "5,3" : "none");
      circle.setAttribute("style", `cursor:${cursor};`);
      circle.setAttribute("data-testid", `map-node-${node.id}`);

      if (isAvailable && !isCurrent) {
        circle.addEventListener("click", () => this.onNodeClick(node.id));
        circle.addEventListener("mouseenter", () => {
          circle.setAttribute("fill", "#2a4a5a");
        });
        circle.addEventListener("mouseleave", () => {
          circle.setAttribute("fill", fill);
        });
      }

      group.appendChild(circle);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", String(coords.x));
      label.setAttribute("y", String(coords.y + 4));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", isForetold && isLocked ? "#8c8" : isLocked ? "#555" : "#ddd");
      label.setAttribute("font-size", "11");
      label.setAttribute("font-weight", "bold");
      const TYPE_ABBREV: Record<string, string> = {
        start: "St", combat: "Co", elite: "El", boss: "Bo",
        shop: "Sh", camp: "Ca", event: "Ev", recruit: "Re", pet: "Pe",
        shrine: "Sr",
        side_route_start: "SQ", side_route_node: "SQ", side_route_return: "SQ",
      };
      label.textContent = TYPE_ABBREV[node.type] ?? node.type.slice(0, 2).toUpperCase();
      group.appendChild(label);

      svg.appendChild(group);

      // Only show title label on visible (non-locked) or foretold nodes to reduce clutter.
      if (!isLocked || isForetold) {
        const textLabel = document.createElementNS(svgNS, "text");
        textLabel.setAttribute("x", String(coords.x));
        textLabel.setAttribute("y", String(coords.y + NODE_RADIUS + 14));
        textLabel.setAttribute("text-anchor", "middle");
        textLabel.setAttribute("fill", isForetold && isLocked ? "#8c8" : "#aaa");
        textLabel.setAttribute("font-size", "10");
        textLabel.setAttribute("style", "pointer-events:none;");
        const maxLen = 13;
        textLabel.textContent =
          node.title.length > maxLen ? node.title.slice(0, maxLen - 1) + "…" : node.title;
        svg.appendChild(textLabel);
      }
    }

    mapEl.appendChild(svg);

    const infoBar = document.createElement("div");
    infoBar.style.cssText = "margin-top:8px;font-size:13px;color:#aaa;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;";
    const run = gameState.run!;
    ensureRunRestState(run);
    const modDef = run.adventureModifierId ? ADVENTURE_MODIFIER_REGISTRY[run.adventureModifierId] : undefined;
    const modText = modDef
      ? `Modifier: ${modDef.displayName} (${modDef.bonusDescription} / ${modDef.drawbackDescription})`
      : "Modifier: None";
    const remaining = shortRestsRemaining(run);
    infoBar.innerHTML = `<span>Gold: ${run.gold}</span><span>Camp Supplies: ${run.campSupplies ?? 0}</span><span>Short Rests remaining before next Long Rest: ${remaining}</span><span>Cleared: ${run.mapState.nodesCleared}</span><span>Boss: ${run.mapState.bossDefeated ? "Yes" : "No"}</span><span style="color:#8cf;">${modText}</span><span style="color:#888;font-size:11px;">Seed: ${run.seed}</span>`;

    const shortRestBtn = document.createElement("button");
    shortRestBtn.setAttribute("data-testid", "map-short-rest");
    shortRestBtn.textContent = "Short Rest";
    shortRestBtn.style.cssText = "padding:6px 12px;font-size:12px;";
    const disabledReason = this.shortRestDisabledReason(run);
    if (disabledReason) {
      shortRestBtn.disabled = true;
      shortRestBtn.title = disabledReason;
      shortRestBtn.textContent = `Short Rest - ${disabledReason}`;
      shortRestBtn.style.opacity = "0.55";
    } else {
      shortRestBtn.addEventListener("click", () => {
        const result = applyShortRest(run, gameState.rng);
        shortRestMessage = result.ok
          ? `${result.message} ${result.heroes.map((h) => `${h.displayName}: ${h.beforeHp}->${h.afterHp} HP (${h.diceSpent} HD)`).join(", ")}`
          : result.message;
        this.app.render();
      });
    }
    infoBar.appendChild(shortRestBtn);
    container.appendChild(mapEl);
    container.appendChild(infoBar);

    if (shortRestMessage) {
      const msg = document.createElement("div");
      msg.style.cssText = "margin-top:6px;color:#9f9;font-size:13px;text-align:center;";
      msg.textContent = shortRestMessage;
      container.appendChild(msg);
    }

    const inventoryBtn = document.createElement("button");
    inventoryBtn.textContent = "Inventory";
    inventoryBtn.setAttribute("data-testid", "map-inventory-btn");
    inventoryBtn.style.cssText = "padding:10px 28px;font-size:15px;margin-top:8px;";
    inventoryBtn.addEventListener("click", () => {
      gameState.screen = "inventory";
      this.app.render();
    });
    container.appendChild(inventoryBtn);

    const logBtn = document.createElement("button");
    logBtn.textContent = showAdventureLog ? "Hide Adventure Log" : "Adventure Log";
    logBtn.setAttribute("data-testid", "map-adventure-log-btn");
    logBtn.style.cssText = "padding:10px 28px;font-size:15px;margin-top:8px;";
    logBtn.addEventListener("click", () => {
      showAdventureLog = !showAdventureLog;
      this.app.render();
    });
    container.appendChild(logBtn);

    if (showAdventureLog) {
      container.appendChild(this.renderAdventureLogPanel(run));
    }

    return container;
  }

  private renderAdventureLogPanel(run: NonNullable<typeof gameState.run>): HTMLElement {
    const panel = document.createElement("div");
    panel.setAttribute("data-testid", "adventure-log-panel");
    panel.style.cssText =
      "border:1px solid #555;border-radius:8px;padding:12px;background:#1a1a2a;width:100%;max-width:700px;margin-top:8px;max-height:300px;overflow-y:auto;";

    const heading = document.createElement("div");
    heading.style.cssText = "font-weight:bold;font-size:14px;margin-bottom:8px;color:#ccf;";
    heading.textContent = "Adventure Log";
    panel.appendChild(heading);

    const log = ensureAdventureLog(run);
    if (log.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:#666;font-size:13px;";
      empty.textContent = "No adventure log entries yet.";
      panel.appendChild(empty);
      return panel;
    }

    for (const entry of log) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid #333;";
      const kindEl = document.createElement("span");
      kindEl.style.cssText = "color:#888;min-width:100px;flex-shrink:0;";
      kindEl.textContent = entry.kind.replace(/_/g, " ");
      const textEl = document.createElement("span");
      textEl.style.cssText = "color:#ccc;";
      textEl.textContent = entry.text;
      row.appendChild(kindEl);
      row.appendChild(textEl);
      panel.appendChild(row);
    }

    return panel;
  }

  private shortRestDisabledReason(run: NonNullable<typeof gameState.run>): string | null {
    if (shortRestsRemaining(run) <= 0) return "none remaining";
    if (!canAnyHeroSpendHitDice(run.party)) return "no wounded hero with Hit Dice";
    return null;
  }

  private onNodeClick(nodeId: string): void {
    const run = gameState.run;
    if (!run) return;
    const mapState = run.mapState;
    const available = availableNextNodes(mapState);
    if (!available.includes(nodeId)) return;

    const nodeDef = NODE_REGISTRY[nodeId];
    if (!nodeDef) return;

    visitNode(mapState, nodeId);

    appendAdventureLogOnce(run, `node_visit:${nodeId}`, {
      kind: "node_visit",
      text: `Visited ${nodeDef.title} (${nodeDef.type}).`,
      nodeId,
    });

    if (nodeDef.type === "combat" || nodeDef.type === "boss" || nodeDef.type === "elite") {
      const encounterId = resolveNodeEncounterId(nodeDef, gameState.rng);
      if (encounterId) {
        gameState.combat = createCombatFromRun(run, encounterId, gameState.rng, nodeDef.type);
        gameState.screen = "combat";
        this.app.render();
      }
      return;
    }

    if (nodeDef.type === "shop" || nodeDef.type === "camp" || nodeDef.type === "event" || nodeDef.type === "recruit" || nodeDef.type === "pet") {
      gameState.screen = nodeDef.type;
      this.app.render();
      return;
    }

    if (nodeDef.type === "side_route_start") {
      // The side quest screen handles the full chain from here.
      gameState.screen = "side_quest_node";
      this.app.render();
      return;
    }

    this.app.render();
  }
}
