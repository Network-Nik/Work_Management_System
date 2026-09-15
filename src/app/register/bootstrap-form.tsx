"use client";

import { useActionState } from "react";
import {
  bootstrapInitialAdmin,
  type RegisterFormState,
} from "@/app/register/actions";

type BootstrapFormProps = {
  email: string;
};

const initialState: RegisterFormState = {};

export function BootstrapForm({ email }: BootstrapFormProps) {
  const [state, formAction, pending] = useActionState(
    bootstrapInitialAdmin,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm text-indigo-900 mb-6">
        <p className="font-semibold text-indigo-950">Development Bootstrap Mode</p>
        <p className="mt-1 text-xs leading-5 text-indigo-900/90">
          No system administrators exist. The first user to provide a verified WhatsApp number will automatically claim the root administrator role for this workspace.
        </p>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-slate-800"
          htmlFor="admin-email"
        >
          Administrator Email
        </label>
        <input
          className="mt-2 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-base text-slate-600 cursor-not-allowed outline-none"
          defaultValue={email}
          disabled
          id="admin-email"
          type="email"
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium text-slate-800"
          htmlFor="whatsapp_number"
        >
          WhatsApp Number
        </label>
        <input
          aria-describedby="whatsapp-hint"
          autoComplete="tel"
          className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
          id="whatsapp_number"
          name="whatsapp_number"
          pattern="^\+[1-9][0-9]{7,14}$"
          placeholder="+94771234567"
          required
          type="tel"
        />
        <p className="mt-1.5 text-xs text-slate-500" id="whatsapp-hint">
          Use international E.164 format with country code (e.g. +94771234567).
        </p>
      </div>

      {state.error && (
        <div
          aria-live="polite"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {state.error}
        </div>
      )}

      <button
        className="flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Initializing Workspace…" : "Claim Administrator Role"}
      </button>
    </form>
  );
}

