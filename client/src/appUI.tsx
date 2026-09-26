import { useState } from "react";
import type { ReactNode } from "react";
import { useAppT } from "./appCopy";
import { Button, COLORS, DAYS, Icon } from "./ui";
import type { FieldDef, Option } from "./ui";

// The pieces only the signed-in app uses. They live apart from ui.tsx so that the app copy
// they read is downloaded with the app, not with the landing page.
const optionValue = (option: Option) => (typeof option === "string" ? option : option.value);
const optionLabel = (option: Option) => (typeof option === "string" ? option : option.label);

export type Question = { title: string; text?: string; confirmLabel?: string; danger?: boolean };

export function ConfirmDialog({ question, onAnswer }: { question: Question; onAnswer: (yes: boolean) => void }) {
  const t = useAppT();
  return <div className="drawer-layer confirm-layer" onClick={() => onAnswer(false)}>
    <div className="confirm-box" role="alertdialog" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
      <span className="confirm-icon" style={{ background: question.danger ? "#FDE8E8" : COLORS.tealLight, color: question.danger ? COLORS.red : COLORS.teal }}>
        <Icon name={question.danger ? "trash" : "warning"} size={19} />
      </span>
      <h2 id="confirm-title">{question.title}</h2>
      {question.text && <p>{question.text}</p>}
      <div className="confirm-actions">
        <Button variant="outline" onClick={() => onAnswer(false)}>{t.common.cancel}</Button>
        <Button variant={question.danger ? "danger" : "primary"} onClick={() => onAnswer(true)}>{question.confirmLabel ?? t.common.confirm}</Button>
      </div>
    </div>
  </div>;
}

export function FormModal({ title, subtitle, fields, initial, submitLabel, onClose, onSubmit, validate }: {
  title: string; subtitle?: string; fields: FieldDef[] | ((values: Record<string, string>) => FieldDef[]); initial: Record<string, string>; submitLabel: string;
  onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<boolean> | boolean;
  validate?: (values: Record<string, string>) => Record<string, string>;
}) {
  const t = useAppT();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const visibleFields = typeof fields === "function" ? fields(values) : fields;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string) => { setValues((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: "" })); };
  const submit = async () => {
    const next: Record<string, string> = {};
    for (const field of visibleFields) {
      const value = String(values[field.key] ?? "").trim();
      if (field.required && !value) next[field.key] = t.common.required;
      else if (field.type === "number" && value && (!Number.isFinite(Number(value)) || Number(value) < (field.min ?? 0))) next[field.key] = t.common.numberMin(field.min ?? 0);
      else if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) next[field.key] = t.common.invalidEmail;
    }
    Object.assign(next, validate?.(values) ?? {});
    if (Object.values(next).some(Boolean)) { setErrors(next); return; }
    setBusy(true);
    const ok = await onSubmit(values);
    setBusy(false);
    if (ok) onClose();
  };
  const input = (field: FieldDef) => {
    const value = values[field.key] ?? "";
    if (field.type === "select") return <select className="field" value={value} onChange={(event) => set(field.key, event.target.value)}>{(field.options ?? []).map((option) => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}</select>;
    if (field.type === "textarea") return <textarea className="field textarea" value={value} onChange={(event) => set(field.key, event.target.value)} placeholder={field.placeholder} />;
    if (field.type === "days") {
      const selected = value ? value.split(",") : [];
      const toggle = (day: string) => set(field.key, DAYS.filter((d) => (d === day ? !selected.includes(d) : selected.includes(d))).join(","));
      return <div className="days-picker">{DAYS.map((day) => <button type="button" key={day} className={selected.includes(day) ? "active" : ""} aria-pressed={selected.includes(day)} onClick={() => toggle(day)}>{t.v.day[day]}</button>)}</div>;
    }
    return <input className="field" type={field.type ?? "text"} min={field.type === "number" ? field.min ?? 0 : undefined} value={value} onChange={(event) => set(field.key, event.target.value)} placeholder={field.placeholder} />;
  };
  return <div className="drawer-layer" onClick={onClose}><div className="form-modal" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
    <div className="form-modal-head"><div><span className="eyebrow">{subtitle || t.common.form}</span><h2>{title}</h2></div><button className="close-button" onClick={onClose} aria-label={t.common.close}><Icon name="close" size={20} /></button></div>
    <div className="form-modal-body"><div className="form-modal-grid">{visibleFields.map((field) => <div className={`form-field ${field.full ? "full" : ""}`} key={field.key}>
      <label>{field.label}{field.required && " *"}</label>
      {input(field)}
      {errors[field.key] && <span className="field-error">{errors[field.key]}</span>}
    </div>)}</div></div>
    <div className="form-modal-foot"><Button variant="outline" onClick={onClose}>{t.common.cancel}</Button><Button icon="check" disabled={busy} onClick={submit}>{busy ? t.common.saving : submitLabel}</Button></div>
  </div></div>;
}

export function Drawer({ title, eyebrow, children, onClose }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void }) {
  const t = useAppT();
  return <div className="drawer-layer" onClick={onClose}><aside className="drawer" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">{eyebrow ?? t.common.detail}</span><h2>{title}</h2></div><button className="close-button" onClick={onClose} aria-label={t.common.close}><Icon name="close" size={20} /></button></div>{children}</aside></div>;
}


