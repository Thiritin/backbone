import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../store";

const ICONS = [{ app: "Getting started", icon: BookOpen }];

export function DesktopIcons() {
  const openApp = useStore((s) => s.openApp);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const clear = () => setSelected(null);
    window.addEventListener("pointerdown", clear);
    return () => window.removeEventListener("pointerdown", clear);
  }, []);

  return (
    <div className="desktop-icons">
      {ICONS.map(({ app, icon: Icon }) => (
        <button
          key={app}
          className={`desktop-icon${selected === app ? " selected" : ""}`}
          onPointerDown={(e) => { e.stopPropagation(); setSelected(app); }}
          onDoubleClick={() => openApp(app)}
          onKeyDown={(e) => e.key === "Enter" && openApp(app)}
        >
          <span className="di-page"><Icon /></span>
          <span className="di-label">{app}</span>
        </button>
      ))}
    </div>
  );
}
