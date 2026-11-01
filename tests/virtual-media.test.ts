import { describe, expect, it } from "vitest";
import { stickOs } from "../src/sim/60-infra/oob";
import { downloadImage, mountVirtualMedia } from "../src/sim/90-actions/media";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, isoOf, readyGame } from "./fixtures";

// The basement server with a management controller and a downloaded image.
function setup() {
  const s = readyGame(1), d = s.devices.find((x) => x.id === BASEMENT_SERVER)!, image = isoOf(s, "lunix");
  downloadImage(s, image);
  return { s, d, image };
}
const withBmc = (d: { model: string; brand: string }) => { d.model = "g2-compute"; d.brand = "Dwell"; };

describe("virtual media", () => {
  it("needs a reachable management controller and a downloaded image", () => {
    const { s, d, image } = setup();
    expect(mountVirtualMedia(s, d.id, image)).toEqual({ ok: false, error: "error.noController" });
    withBmc(d);
    expect(mountVirtualMedia(s, d.id, isoOf(s, "windoors"))).toEqual({ ok: false, error: "error.noImage" });
    expect(mountVirtualMedia(s, d.id, image).ok).toBe(true);
  });

  it("makes the image the boot source of a server waiting in setup", () => {
    const { s, d, image } = setup();
    withBmc(d);
    d.setup = true;
    expect(mountVirtualMedia(s, d.id, image).ok).toBe(true);
    expect(d.virtualMedia).toBe(image);
    expect(d.bootFrom).toBe("usb");
    expect(stickOs(s, d.id)).toBe(image);
  });

  it("ejects the image and refuses to eject when none is mounted", () => {
    const { s, d, image } = setup();
    withBmc(d);
    expect(mountVirtualMedia(s, d.id, null).ok).toBe(false);
    mountVirtualMedia(s, d.id, image);
    expect(mountVirtualMedia(s, d.id, null).ok).toBe(true);
    expect(d.virtualMedia).toBeUndefined();
    expect(stickOs(s, d.id)).toBeNull();
  });

  it("loads an old save without the field and keeps a mounted image", () => {
    const { s, d, image } = setup();
    expect(deserialize(serialize(s)).devices.find((x) => x.id === d.id)!.virtualMedia).toBeUndefined();
    withBmc(d);
    mountVirtualMedia(s, d.id, image);
    expect(deserialize(serialize(s)).devices.find((x) => x.id === d.id)!.virtualMedia).toBe(image);
  });
});
