import type { App } from "../App.ts";
import { gameState } from "../../state/GameState.ts";
import { NODE_REGISTRY, ALL_NODES } from "../../data/nodes.ts";
import type { NodeDef } from "../../data/nodes.ts";
import { availableNextNodes, visitNode } from "../../run/MapGraph.ts";
import { createCombatFromRun } from "../../state/GameState.ts";

const LAYER_COLORS: Record<string, string> = {
  start: "#4a8",
  combat: "#c44",
  elite: "#c84",
  boss: "#f22",
  shop: "#48c",
  camp: "#4a4",
  event: "#ca4",
  recruit: "#8c4",
};

const NODE_RADIUS = 28;

function buildLayers(): NodeDef[][] {
  const layers: NodeDef[][] = [];
  for (const node of ALL_NODES) {
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

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:20px;";

    const title = document.createElement("h2");
    title.textContent = "The Haunted Wilds";
    container.appendChild(title);

    const mapEl = document.createElement("div");
    mapEl.style.cssText = "position:relative;width:800px;height:500px;margin-top:10px;";

    const layers = buildLayers();
    const mapState = gameState.run!.mapState;
    const available = availableNextNodes(mapState);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "800");
    svg.setAttribute("height", "500");
    svg.style.cssText = "position:absolute;top:0;left:0;";

    const nodeCoords: Map<string, { x: number; y: number }> = new Map();

    const layerWidth = 720 / (layers.length + 1);
    for (let li = 0; li < layers.length; li++) {
      const nodes = layers[li];
      const x = 40 + layerWidth * (li + 1) - layerWidth / 2;
      const spacing = Math.min(100, 400 / (nodes.length + 1));
      const startY = 250 - (spacing * (nodes.length - 1)) / 2;
      for (let ni = 0; ni < nodes.length; ni++) {
        const y = startY + spacing * ni;
        nodeCoords.set(nodes[ni].id, { x, y });
      }
    }

    for (const node of ALL_NODES) {
      for (const nextId of node.nextNodeIds) {
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

    for (const node of ALL_NODES) {
      const coords = nodeCoords.get(node.id);
      if (!coords) continue;

      const isCurrent = mapState.currentNodeId === node.id;
      const isVisited = mapState.visitedNodeIds.includes(node.id);
      const isAvailable = available.includes(node.id);
      const isLocked = !isVisited && !isAvailable && !isCurrent;

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
      } else if (isLocked) {
        fill = "#1a1a1a";
        stroke = "#333";
        strokeWidth = 1;
      }

      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", stroke);
      circle.setAttribute("stroke-width", String(strokeWidth));
      circle.setAttribute("style", `cursor:${cursor};`);

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
      label.setAttribute("fill", isLocked ? "#555" : "#ddd");
      label.setAttribute("font-size", "11");
      label.setAttribute("font-weight", "bold");
      const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1, 2);
      label.textContent = typeLabel;
      group.appendChild(label);

      svg.appendChild(group);

      const textLabel = document.createElementNS(svgNS, "text");
      textLabel.setAttribute("x", String(coords.x));
      textLabel.setAttribute("y", String(coords.y + NODE_RADIUS + 16));
      textLabel.setAttribute("text-anchor", "middle");
      textLabel.setAttribute("fill", isLocked ? "#444" : "#aaa");
      textLabel.setAttribute("font-size", "10");
      textLabel.setAttribute("style", "pointer-events:none;");
      textLabel.textContent = node.title.length > 18 ? node.title.slice(0, 16) + "..." : node.title;
      svg.appendChild(textLabel);
    }

    mapEl.appendChild(svg);

    const infoBar = document.createElement("div");
    infoBar.style.cssText = "margin-top:8px;font-size:13px;color:#aaa;";
    const run = gameState.run!;
    infoBar.textContent = `Gold: ${run.gold} | Cleared: ${run.mapState.nodesCleared} | Boss: ${run.mapState.bossDefeated ? "Yes" : "No"}`;
    container.appendChild(mapEl);
    container.appendChild(infoBar);

    return container;
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
    mapState.nodesCleared++;

    if (nodeDef.type === "combat" || nodeDef.type === "boss" || nodeDef.type === "elite") {
      if (nodeDef.encounterId) {
        gameState.combat = createCombatFromRun(run, nodeDef.encounterId, gameState.rng);
        gameState.screen = "combat";
        this.app.render();
      }
      return;
    }

    this.app.render();
  }
}
