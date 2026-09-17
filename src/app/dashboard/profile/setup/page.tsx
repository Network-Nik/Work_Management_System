"use client";

import { useActionState } from "react";
import { completeProfile } from "./actions";

export default function ProfileSetupPage() {
  const [state, formAction, pending] = useActionState(
    async (prevState: any, formData: FormData) => {
      return completeProfile(formData);
    },
    null
  );

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight mb-2">
          Complete Your Profile
        </h1>
        <p className="text-zinc-400 text-sm mb-8">
          Before you can access the workspace, please establish your professional identity.
        </p>

        <form action={formAction} className="space-y-6">
          {state?.error && (
            <div className="p-3 bg-red-900/30 border border-red-900/50 text-red-400 text-sm rounded-xl">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              name="display_name"
              required
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-colors"
              placeholder="e.g. Nikil Perera"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">@</span>
              <input
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={30}
                pattern="^[a-zA-Z0-9_.-]+$"
                title="Letters, numbers, underscores, dots, and hyphens only."
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-colors"
                placeholder="nikil.perera"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Lowercase, 3-30 characters. Used for mentions and directories.
            </p>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

