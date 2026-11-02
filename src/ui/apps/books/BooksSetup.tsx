import { sells, type BooksVendor } from "../../../sim/10-catalog/bookkeeping";
import { finishBooksSetup } from "../../../sim/90-actions/bookkeeping";
import type { GameState } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import { BankStep, CompanyStep, DoneStep, NumberingStep, SetupWizard, TaxStep, type SetupStep } from "../setup/SetupWizard";

// The first-run wizard of a Books program; a program without tax returns skips the tax step.
export function BooksSetup({ v, game, close }: { v: BooksVendor; game: GameState; close: (tab?: string) => void }) {
  const act = useStore((s) => s.act);
  const [step, setStep] = useSessionState<string | undefined>("books.setupStep", undefined);
  const finish = (tab?: string) => { act(finishBooksSetup); setStep(undefined); close(tab); };
  const steps: SetupStep[] = [
    { id: "company", label: t("setup.step.company"), body: <CompanyStep game={game} /> },
    ...(sells(v, "tax") ? [{ id: "tax", label: t("setup.step.tax"), body: <TaxStep game={game} /> }] : []),
    { id: "bank", label: t("setup.step.bank"), body: <BankStep game={game} /> },
    { id: "numbering", label: t("setup.step.numbering"), body: <NumberingStep game={game} /> },
    { id: "done", label: t("setup.step.done"), body: <DoneStep links={["customers", "invoices", "bank"].map((id) => [t(`books.tab.${id}`), () => finish(id)])} /> },
  ];
  return <SetupWizard program={v.program} steps={steps} step={step} onStep={setStep} onClose={() => finish()} />;
}
