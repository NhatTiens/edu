import "server-only";
import { configuredOrigin } from "@/lib/security/config";
export function siteOrigin() { return configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL); }
