"use client";

import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { markToasterReady } from './toast-readiness';

export default function ReadyToaster() {
  // Child passive effects subscribe Sonner before this parent announces readiness.
  useEffect(markToasterReady, []);
  return <Toaster />;
}
