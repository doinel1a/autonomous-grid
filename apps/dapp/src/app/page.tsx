import React from 'react';

import { api } from '../server/trpc';
import WizardChat from './_components/chat/wizard';

export default async function HomePage() {
  const user = await api.users.getByAddress({ address: '0x123' });
  console.log('user', user);

  return (
    <main className='flex h-full w-full overflow-hidden px-2.5 pt-2.5'>
      <WizardChat />
    </main>
  );
}
