import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type TRadioGroupOption = {
  id: string;
  value: string;
  label: string;
  description?: string;
};

type TFieldChoiceCard = {
  fieldId?: string;
  title?: string;
  description?: string;
  radioGroupDefaultValue: string;
  radioGroupOptions: TRadioGroupOption[];
  className?: string;
  disabled?: boolean;
  onOptionSelect?: (option: string) => void;
};

export function FieldChoiceCard({
  fieldId,
  title,
  description,
  radioGroupDefaultValue,
  radioGroupOptions,
  className,
  disabled,
  onOptionSelect
}: Readonly<TFieldChoiceCard>) {
  return (
    <div className={cn('w-full max-w-md', className)}>
      <FieldGroup>
        <FieldSet>
          {title && <FieldLabel htmlFor={fieldId}>{title}</FieldLabel>}
          {description && <FieldDescription>{description}</FieldDescription>}
          <RadioGroup
            defaultValue={radioGroupDefaultValue}
            disabled={disabled}
            onValueChange={(value) => {
              if (onOptionSelect) {
                onOptionSelect(value);
              }
            }}
          >
            {radioGroupOptions.map((option) => (
              <FieldLabel key={option.id} htmlFor={option.id}>
                <Field orientation='horizontal'>
                  <FieldContent>
                    <FieldTitle>{option.label}</FieldTitle>
                    {option.description && (
                      <FieldDescription>{option.description}</FieldDescription>
                    )}
                  </FieldContent>
                  <RadioGroupItem id={option.id} value={option.value} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>
      </FieldGroup>
    </div>
  );
}
