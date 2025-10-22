import { useState } from 'react';

import type { TRadioGroupOption as TFieldRadioGroupOption } from '@/components/ui/field-choice-card';
import type { TEnergyProfile } from '@/lib/constants/shared';
import type { TSendMessage } from '@/lib/types/shared';

import { FieldChoiceCard } from '@/components/ui/field-choice-card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type TRadioGroupOption = TFieldRadioGroupOption & {
  value: TEnergyProfile;
};

const energyProfiles: TRadioGroupOption[] = [
  {
    id: 'consumer',
    value: 'consumer',
    label: 'Consumer',
    description: 'You mainly consume energy'
  },
  {
    id: 'producer',
    value: 'producer',
    label: 'Producer',
    description: 'You mainly produce energy'
  },
  {
    id: 'prosumer',
    value: 'prosumer',
    label: 'Prosumer',
    description: 'You both produce and consume energy'
  }
] as const;

type TSelectEnergyProfile = {
  className?: string;
  sendMessage: (message: TSendMessage) => Promise<void>;
};

export default function SelectEnergyProfile({
  className,
  sendMessage
}: Readonly<TSelectEnergyProfile>) {
  const [submitted, setSubmitted] = useState(false);

  const onOptionSelect = (option: string) => {
    const profile = energyProfiles.find((profile) => profile.value === option);
    if (!profile) {
      console.error('CLIENT ERROR: Invalid energy profile option', option);
      return;
    }

    const profileLabel = profile.label;
    void sendMessage({ text: `I'm a ${profileLabel} user.` });
    setSubmitted(true);
  };

  return (
    <div className={cn('', className)}>
      <FieldChoiceCard
        radioGroupDefaultValue=''
        radioGroupOptions={energyProfiles}
        className='max-w-full'
        disabled={submitted}
        onOptionSelect={onOptionSelect}
      />

      <Separator className='my-2.5' />
    </div>
  );
}
