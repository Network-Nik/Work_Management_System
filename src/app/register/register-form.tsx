"use client";

import { useActionState } from "react";
import {
  registerStaffProfile,
  type RegisterFormState,
} from "@/app/register/actions";

type RegisterFormProps = {
  email: string;
};

const initialState: RegisterFormState = {};

export function RegisterForm({ email }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(
    registerStaffProfile,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label
          className="block text-sm font-medium text-slate-800"
          htmlFor="registered-email"
        >
          Approved Email Address
        </label>
        <input
          aria-describedby="email-hint"
          className="mt-2 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-base text-slate-600 cursor-not-allowed outline-none"
          defaultValue={email}
          disabled
          id="registered-email"
          type="email"
        />
        <p className="mt-1.5 text-xs text-slate-500" id="email-hint">
          This email was verified and matched to the approved staff allowlist.
        </p>
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
        {pending ? "Submitting Registration…" : "Complete Registration"}
      </button>
    </form>
  );
}

