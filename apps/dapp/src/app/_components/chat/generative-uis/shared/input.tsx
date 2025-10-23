import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group';

type TInput = {
  value: string;
  placeholder: string;
  endAddon?: string;
  disabled: boolean;
  setValue: (value: string) => void;
};

export default function Input({
  value,
  placeholder,
  endAddon,
  disabled,
  setValue
}: Readonly<TInput>) {
  return (
    <InputGroup>
      <InputGroupInput
        value={value}
        placeholder={placeholder}
        className='placeholder:text-sm'
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />

      {endAddon && (
        <InputGroupAddon align='inline-end'>
          <InputGroupText>{endAddon}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
