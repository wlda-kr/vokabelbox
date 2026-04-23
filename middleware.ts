import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Alle Routen außer:
     * - _next/static (statische Assets)
     * - _next/image (Image-Optimization)
     * - favicon.ico, manifest.json, Icons
     * - Dateien mit Endungen (bilder etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
