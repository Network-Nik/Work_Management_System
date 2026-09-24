"use client";

import { useTransition, useRef, useState } from "react";
import { updateOrganization } from "./actions";

interface CompanySettingsProps {
  expectedOrgId: string;
  initialName: string;
}

export function CompanySettings({ expectedOrgId, initialName }: CompanySettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(false);
    
    const newName = formData.get("name")?.toString().trim();
    if (newName === initialName) return;

    startTransition(async () => {
      try {
        const result = await updateOrganization(expectedOrgId, formData);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-6 mb-12">
      <h2 className="text-lg font-semibold text-zinc-200 mb-1">Company Settings</h2>
      <p className="text-sm text-zinc-500 mb-6">Manage your organization's identity and core details.</p>
      
      <form ref={formRef} action={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-zinc-300 mb-2">
            Organization Name
          </label>
          <input
            id="org-name"
            name="name"
            type="text"
            defaultValue={initialName}
            required
            minLength={2}
            maxLength={100}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
            placeholder="e.g. Acme Corp"
            disabled={isPending}
          />
        </div>

        {error && (
          <div className="text-sm text-rose-400 bg-rose-400/10 rounded-lg p-3 border border-rose-400/20">
            {error}
          </div>
        )}
        
        {success && (
          <div className="text-sm text-emerald-400 bg-emerald-400/10 rounded-lg p-3 border border-emerald-400/20">
            Settings saved successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

