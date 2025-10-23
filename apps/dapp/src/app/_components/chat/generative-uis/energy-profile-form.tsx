/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { useState } from 'react';

import type { TEnergyProfile } from '@/lib/constants/shared';
import type { TSendMessage } from '@/lib/types/shared';

import { Button } from '@heroui/button';

import { Checkbox as SCN_Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { energyProfile as energyProfileValue, unit } from '@/lib/constants/shared';
import { cn } from '@/lib/utils';

import Input from './shared/input';

type TEnergyProfileForm = {
  energyProfile: TEnergyProfile;
  className?: string;
  sendMessage: (message: TSendMessage) => Promise<void>;
};

export default function EnergyProfileForm({
  energyProfile,
  className,
  sendMessage
}: Readonly<TEnergyProfileForm>) {
  const isConsumer = energyProfile === energyProfileValue.consumer;
  const isProducer = energyProfile === energyProfileValue.producer;
  const isProsumer = energyProfile === energyProfileValue.prosumer;

  const [submitted, setSubmitted] = useState(false);
  const [production, setProduction] = useState('');
  const [consumption, setConsumption] = useState('');
  const [hasBattery, setHasBattery] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState('');
  const [hasEV, setHasEV] = useState(false);
  const [evBatteryCapacity, setEVBatteryCapacity] = useState('');

  const onSubmit = () => {
    let prompt: string | undefined;
    if (isConsumer) {
      const isEVBatteryCapacityValid = evBatteryCapacity !== '';
      const totalConsumption = isEVBatteryCapacityValid
        ? Number(consumption) + Number(evBatteryCapacity)
        : consumption;

      prompt = `
        As a Consumer, I use aproximately ${totalConsumption} kWh every 24 hours. 
        ${isEVBatteryCapacityValid ? `The total consumption already includes the charging of my EV, which has a battery capacity of ${evBatteryCapacity} kWh.` : ''}
      `;
    } else if (isProducer) {
      const isBatteryCapacityValid = batteryCapacity !== '';

      prompt = `
        As a Producer, I produce aproximately ${production} kWh every 24 hours.
        ${isBatteryCapacityValid ? `Also, I have a battery with a capacity of ${batteryCapacity} kWh.` : ''}
      `;
    } else if (isProsumer) {
      const isEVBatteryCapacityValid = evBatteryCapacity !== '';
      const isBatteryCapacityValid = batteryCapacity !== '';
      const totalConsumption = isEVBatteryCapacityValid
        ? Number(consumption) + Number(evBatteryCapacity)
        : consumption;

      prompt = `
        As a Prosumer, I produce aproximately ${production} kWh every 24 hours.
        On the other hand, I consume aproximately ${totalConsumption} kWh every 24 hours.
        ${isEVBatteryCapacityValid ? `The total consumption already includes the charging of my EV, which has a battery capacity of ${evBatteryCapacity} kWh.` : ''}
        ${isBatteryCapacityValid ? `Also, I have a battery with a capacity of ${batteryCapacity} kWh.` : ''}
      `;
    }

    if (!prompt) {
      console.error('CLIENT ERROR: Something went wrong in energy profile form', prompt);
      return;
    }

    void sendMessage({ text: prompt.trim() });
    setSubmitted(true);
  };

  return (
    <div className={cn('', className)}>
      <form className='flex flex-col gap-y-2.5'>
        {(isProducer || isProsumer) && (
          <Input
            value={production}
            placeholder='Enter production'
            endAddon={unit.kwh}
            disabled={submitted}
            setValue={setProduction}
          />
        )}

        {(isConsumer || isProsumer) && (
          <Input
            value={consumption}
            placeholder='Enter consumption'
            endAddon={unit.kwh}
            disabled={submitted}
            setValue={setConsumption}
          />
        )}

        {(isProducer || isProsumer) && (
          <>
            <Checkbox
              id='battery'
              label='I have a battery for energy storage'
              checked={hasBattery}
              disabled={submitted}
              setChecked={setHasBattery}
            />

            {hasBattery && (
              <>
                <Input
                  value={batteryCapacity}
                  placeholder='Enter battery storage capacity'
                  endAddon={unit.kwh}
                  disabled={submitted}
                  setValue={setBatteryCapacity}
                />
                <Separator />
              </>
            )}
          </>
        )}

        {(isConsumer || isProsumer) && (
          <>
            <Checkbox
              id='ev'
              label='I have an electric vehicle'
              checked={hasEV}
              disabled={submitted}
              setChecked={setHasEV}
            />

            {hasEV && (
              <Input
                value={evBatteryCapacity}
                placeholder='Enter EV battery capacity'
                endAddon={unit.kwh}
                disabled={submitted}
                setValue={setEVBatteryCapacity}
              />
            )}
          </>
        )}

        <Button
          type='button'
          color='primary'
          className='ml-auto mt-2.5 w-fit text-white'
          isDisabled={submitted}
          onPress={onSubmit}
        >
          Submit
        </Button>
      </form>

      <Separator className='my-2.5' />
    </div>
  );
}

type TCheckbox = {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  setChecked: (checked: boolean) => void;
};

function Checkbox({ id, label, checked, disabled, setChecked }: Readonly<TCheckbox>) {
  return (
    <Label
      htmlFor={id}
      className='hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950'
    >
      <SCN_Checkbox
        id={id}
        checked={checked}
        className='data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700'
        disabled={disabled}
        onCheckedChange={(checked) => {
          setChecked(!!checked);
        }}
      />

      <p className='text-md font-medium leading-none'>{label}</p>
    </Label>
  );
}
