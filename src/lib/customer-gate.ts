/**
 * Smart customer login gate.
 *
 * The site stays fully browsable: nothing asks for a phone number until the
 * visitor does something that needs an account — make an offer, chat with the
 * seller, or send a support message. Those call `gateCustomerAction()`, which
 * either runs the action straight away (already signed in) or opens the login
 * dialog and remembers what to run once verification succeeds.
 *
 * The request lives in a tiny external store rather than React context so any
 * component, at any depth, can trigger it without prop-drilling a provider
 * through the whole marketplace.
 */
import { useSyncExternalStore } from "react";

import { currentCustomer } from "@/lib/account-store";

export type CustomerGateReason = "offer" | "chat" | "contact";

export type CustomerGateRequest = {
  reason: CustomerGateReason;
  /** Runs after a successful sign-in — usually "open the dialog they clicked". */
  onSuccess?: () => void;
};

/** Copy shown inside the dialog so it never asks for a login without a why. */
export const GATE_COPY: Record<
  CustomerGateReason,
  { kicker: string; title: string; body: string }
> = {
  offer: {
    kicker: "One step before your offer",
    title: "Sign in to make an offer",
    body: "Your offer is saved to your dashboard and matched to your mobile number, so you can track it and reply to the seller from one place.",
  },
  chat: {
    kicker: "One step before the chat",
    title: "Sign in to chat with the seller",
    body: "The conversation is stored against your account, so the seller's replies reach you here and you never lose the thread.",
  },
  contact: {
    kicker: "One step before we reply",
    title: "Sign in to send your message",
    body: "A quick mobile verification keeps your request attached to your account, so our team can follow up on the right thread.",
  },
};

const listeners = new Set<() => void>();
let pending: CustomerGateRequest | null = null;

function emit() {
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Show the login dialog. */
export function requestCustomerLogin(request: CustomerGateRequest) {
  pending = request;
  emit();
}

/** Close the dialog without running the pending action. */
export function dismissCustomerLogin() {
  pending = null;
  emit();
}

/** Verification succeeded: close the dialog and run the action that asked for it. */
export function completeCustomerLogin() {
  const request = pending;
  pending = null;
  emit();
  request?.onSuccess?.();
}

/** Current request, or null when the dialog is closed. */
export function useCustomerLoginRequest(): CustomerGateRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
}

/**
 * Gate an action behind a verified customer session.
 *
 * Returns true when the action ran immediately. When it returns false the login
 * dialog is open and `run` fires after a successful verification.
 */
export function gateCustomerAction(reason: CustomerGateReason, run: () => void): boolean {
  if (currentCustomer()) {
    run();
    return true;
  }
  requestCustomerLogin({ reason, onSuccess: run });
  return false;
}
