import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { guideOf, type GuideApp, type GuideStep } from "../../../../../../sim/60-infra/install-guide";
import type { ShopId } from "../../../../../../sim/10-catalog/shops";
import { useStore } from "../../../../../store";

export interface GuideListProps {
  shop: ShopId;
  version: string;
  // Each product draws its steps in its own look; the default renders a plain ordered list.
  renderItem?: (step: GuideStep, state: { n: number; current: boolean; label: string; appLabel: string; open: () => void }) => ReactNode;
  // Where a step is done: the host opens the panel app or screen.
  onOpen?: (app: GuideApp, step: GuideStep) => void;
}

// The install guide of a shop system as data: steps in order, ticks, the current step and a link target per step.
export function GuideList({ shop, version, renderItem, onOpen }: GuideListProps) {
  const game = useStore((s) => s.game), steps = guideOf(game, shop, version), current = steps.findIndex((x) => !x.done && !x.optional);
  return (
    <ol>
      {steps.map((step, i) => {
        const state = { n: i + 1, current: i === current, label: t(step.labelKey, step.params), appLabel: step.app ? t(`install-guide.app.${step.app}`) : "", open: () => step.app && onOpen?.(step.app, step) };
        return renderItem ? <li key={step.id}>{renderItem(step, state)}</li> : (
          <li key={step.id} data-done={step.done} aria-current={state.current ? "step" : undefined}>
            <input type="checkbox" checked={step.done} readOnly aria-label={state.label} />
            {onOpen && step.app ? <a href="#" onClick={(e) => { e.preventDefault(); state.open(); }}>{state.label}</a> : state.label}
          </li>
        );
      })}
    </ol>
  );
}
