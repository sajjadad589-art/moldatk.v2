import React from 'react';

export type SecureResetResult = { ok: boolean; message?: string };

interface Props {
  isOwner: boolean;
  onResetSystem: (password: string) => Promise<SecureResetResult>;
  compact?: boolean;
}

/**
 * Owner-side factory reset has been intentionally removed from the product UI.
 *
 * Keeping this compatibility component as a null render avoids breaking older
 * settings surfaces that may still import it while guaranteeing that no reset
 * button, modal, confirmation phrase, or destructive control is rendered on
 * mobile or desktop.
 *
 * Permanent account deletion remains an owner-only Super Admin operation.
 */
export const SecureSystemReset: React.FC<Props> = () => null;
