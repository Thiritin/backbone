import { Check } from "lucide-react";
import { STORE } from "../../sim/10-catalog/store";
import { research } from "../../sim/90-actions/store";
import { useStore } from "../store";
import { Tile } from "./shop/Software";
import "./shop/shop.css";

export function UnlocksApp() {
  const { game, act } = useStore();
  const known = Math.floor(game.knowHow);
  return (
    <div className="unl">
      <div className="unl-head"><span>Know-how</span><strong className="num">{known}</strong></div>
      <table className="table">
        <thead><tr><th>Research</th><th>Kind</th><th className="r">Cost</th><th /></tr></thead>
        <tbody>
          {STORE.filter((item) => item.knowHow > 0).map((item) => {
            const done = game.unlocks.includes(item.id);
            return (
              <tr key={item.id}>
                <td><span className="unl-name"><Tile item={item} size={24} />{item.name}</span></td>
                <td>{item.kind === "app" ? "App" : "Upgrade"}</td>
                <td className="r num">{item.knowHow}</td>
                <td className="r">
                  {done ? <span className="pill ok"><Check />Researched</span>
                    : <button className="btn primary" disabled={known < item.knowHow} onClick={() => act((s) => research(s, item.id))}>Research</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
