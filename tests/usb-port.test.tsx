import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { DeviceSvg } from "../src/ui/art/fronts";

const face = (id: string, brand = "Dwell", stick = false) => renderToString(<DeviceSvg model={modelById(id)} brand={brand} name="srv" state="ok" ports={[]} groups={[]} w={300} u={18} stick={stick} onUsb={() => undefined} />);
const ports = (svg: string) => (svg.match(/aria-label="USB port"/g) ?? []).length;

describe("front USB port", () => {
  it("sits once on every server face, nodes included, and never on a switch or part", () => {
    for (const [id, brand] of [["g1-compute", "Dwell"], ["g3-memory", "Hewlett-Packet"], ["g2-backup", "SuperMacro"], ["g4-archive", "Dwell"], ["g5-gpu", "Dwell"], ["g6-gpu-8", "Gigabutt"], ["g2-twin-node", "SuperMacro"], ["g6-arm", "Hewlett-Packet"]]) {
      expect(ports(face(id, brand)), id).toBe(1);
      expect(face(id, brand), id).toContain('aria-label="Plug in USB stick"');
    }
    // A bare chassis shows a port in each of its four node bays, none of them clickable; the nodes draw their own over them.
    const chassis = face("g2-twin", "SuperMacro");
    expect(ports(chassis)).toBe(4);
    expect(chassis).not.toContain("USB stick");
    expect(ports(face("sw-8", "Sysko"))).toBe(0);
    expect(ports(face("part-ram", "Generic"))).toBe(0);
  });

  it("shows the stick in the port and offers to pull it", () => {
    const svg = face("g2-twin-node", "SuperMacro", true);
    expect(svg).toContain('aria-label="Unplug USB stick"');
    expect(svg).not.toContain('aria-label="Plug in USB stick"');
  });

  it("draws the trident on faces of two units or more only", () => {
    const glyph = (svg: string) => svg.includes("l1.6-1");
    expect(glyph(face("g1-compute"))).toBe(false);
    expect(glyph(face("g1-memory"))).toBe(true);
    expect(glyph(face("g2-backup", "SuperMacro"))).toBe(true);
  });
});
