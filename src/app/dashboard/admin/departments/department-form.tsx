"use client";

import { useActionState, useState } from "react";
import { saveDepartment } from "./actions";

type Props = {
  existingId?: string;
  initialName?: string;
  initialDesc?: string;
  initialActive?: boolean;
  isEdit?: boolean;
};

export function DepartmentForm({ existingId, initialName = "", initialDesc = "", initialActive = true, isEdit = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [state, formAction, pending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await saveDepartment(formData);
      if (result?.success) {
        setIsOpen(false);
      }
      return result;
    },
    null
  );

  if (isEdit && !isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        Edit
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {existingId && <input type="hidden" name="id" value={existingId} />}
      
      {state?.error && (
        <div className="p-2 bg-red-900/30 border border-red-900/50 text-red-400 text-xs rounded-lg">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
        <input
          type="text"
          name="name"
          defaultValue={initialName}
          required
          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-700"
          placeholder="e.g. Design"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Description (Optional)</label>
        <input
          type="text"
          name="description"
          defaultValue={initialDesc}
          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-700"
        />
      </div>

      {isEdit && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={initialActive}
            className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-600"
          />
          <label className="text-xs text-zinc-400">Active (uncheck to archive)</label>
        </div>
      )}
      {!isEdit && (
        <input type="hidden" name="is_active" value="true" />
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

