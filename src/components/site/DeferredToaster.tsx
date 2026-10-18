"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from 'react';
import { subscribeToaster, toasterRequested, toasterServerSnapshot } from './toast-readiness';

const Toaster = dynamic(() => import('./ReadyToaster'), { ssr: false });

export function DeferredToaster() {
  const requested = useSyncExternalStore(subscribeToaster, toasterRequested, toasterServerSnapshot);
  return requested ? <Toaster /> : null;
}
