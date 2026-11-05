// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSessionState } from "../src/ui/session";

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe("installer drafts", () => {
  it("keeps step and values across unmount and remount", () => {
    const use = () => ({ step: useSessionState("inst.vm1.lstep", "boot"), form: useSessionState("inst.vm1.form", { ip: "" }) });
    const a = renderHook(use);
    act(() => { a.result.current.step[1]("network"); a.result.current.form[1]((f) => ({ ...f, ip: "10.0.0.5" })); });
    a.unmount();
    const b = renderHook(use);
    expect(b.result.current.step[0]).toBe("network");
    expect(b.result.current.form[0]).toEqual({ ip: "10.0.0.5" });
  });

  it("keeps drafts of two machines apart", () => {
    const a = renderHook(() => useSessionState("inst.vm1.lstep", "boot"));
    act(() => a.result.current[1]("disk"));
    const b = renderHook(() => useSessionState("inst.vm2.lstep", "boot"));
    expect(b.result.current[0]).toBe("boot");
  });
});
