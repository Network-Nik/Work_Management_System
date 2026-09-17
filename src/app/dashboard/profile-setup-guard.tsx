"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProfileSetupGuard({ isComplete }: { isComplete: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isComplete && pathname !== "/dashboard/profile/setup") {
      router.replace("/dashboard/profile/setup");
    }
  }, [isComplete, pathname, router]);

  return null;
}

