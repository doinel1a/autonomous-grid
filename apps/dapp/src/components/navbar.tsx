import React from 'react';

import { Skeleton } from '@heroui/skeleton';
import { Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

const ThemeToggle = dynamic(() => import('./ui/theme-toggle'), {
  loading: () => <Skeleton className='rounded-medium h-10 w-10' />
});
const Wallet = dynamic(() => import('./wallet'), {
  loading: () => <Skeleton className='rounded-medium h-10 w-32' />
});

export default function Navbar() {
  return (
    <header className='flex w-full items-center justify-between px-2.5 pt-2.5'>
      <div className='gap-x- flex items-end gap-x-0.5'>
        <Zap className='text-muted-foreground size-9 fill-yellow-400' />
        <span className='text-lg font-bold'>Autonomous Grid</span>
      </div>

      <div className='flex items-center gap-x-2.5'>
        <Wallet className='w-32' />
        <ThemeToggle />
      </div>
    </header>
  );
}
