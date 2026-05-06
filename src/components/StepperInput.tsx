import { Minus, Plus } from "lucide-react";
import { IconButton } from "./IconButton";

type StepperInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange(value: number): void;
};

export function StepperInput({ label, value, min, max, step, unit, onChange }: StepperInputProps) {
  const clamp = (nextValue: number) => Math.min(max, Math.max(min, nextValue));

  return (
    <label className="stepper">
      <span>{label}</span>
      <div className="stepper-controls">
        <IconButton
          label={`减少${label}`}
          icon={<Minus size={16} aria-hidden="true" />}
          onClick={() => onChange(clamp(value - step))}
        />
        <input
          value={value}
          min={min}
          max={max}
          step={step}
          type="number"
          inputMode="numeric"
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
        />
        <span className="unit">{unit}</span>
        <IconButton
          label={`增加${label}`}
          icon={<Plus size={16} aria-hidden="true" />}
          onClick={() => onChange(clamp(value + step))}
        />
      </div>
    </label>
  );
}
