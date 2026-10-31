import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

describe("customer addresses", () => {
  it("come from the order's sender and city", () => {
    const s = withServer(newGame(5));
    const id = addCustomer(s, "Renner IT", "smallBiz", "prompt", { contact: "Tobias Renner", company: "Renner IT", city: "Munich" });
    const a = s.customers.find((c) => c.id === id)!.address;
    expect(a).toMatchObject({ contact: "Tobias Renner", company: "Renner IT", email: "renner@renner-it.de" });
    expect(a.zip).toMatch(/^\d{5}$/);
    expect(a.street).toMatch(/ \d+$/);
  });

  it("give private customers a personal mailbox and no company", () => {
    const s = withServer(newGame(5));
    const id = addCustomer(s, "Anna Bauer", "private", "prompt", { contact: "Anna Bauer", company: null, city: "London" });
    const a = s.customers.find((c) => c.id === id)!.address;
    expect(a.company).toBeUndefined();
    expect(a.email).toMatch(/^anna\.bauer@/);
    expect(a.street).toMatch(/^\d+ /);
  });

  it("are filled for saves from before addresses, the same on every load", () => {
    const s = withServer(newGame(5));
    addCustomer(s, "Bäckerei Krause", "soleProp");
    const raw = JSON.parse(serialize(s));
    delete raw.customers[0].address;
    const a = deserialize(JSON.stringify(raw)).customers[0].address;
    expect(a.company).toBe("Bäckerei Krause");
    expect(a.contact).toMatch(/\w+ \w+/);
    expect(deserialize(JSON.stringify(raw)).customers[0].address).toEqual(a);
  });
});
