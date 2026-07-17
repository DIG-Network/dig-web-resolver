/**
 * Configuration a self-hosting site passes to its `dig-sw.js` via the registration
 * query string (e.g. `register("/dig-sw.js?endpoint=https://dig.local")`). Only the
 * engine's §5.3 ladder overrides are read here — an explicit node endpoint and the
 * "Connect to Node" target for the unreachable page. Everything else about a request
 * is carried by the self-contained `/__dig/<urn>` path, so no ambient store pinning
 * is needed (or accepted — a pinned store would be trust-ambient, which we avoid).
 */
import type { DigNetworkOptions } from "@dignetwork/dig-urn-resolver";

/** The engine options a `dig-sw.js` registration query may set (all optional). */
export function engineOptionsFromQuery(search: string): DigNetworkOptions {
  const query = new URLSearchParams(search);
  const options: DigNetworkOptions = {};
  const endpoint = query.get("endpoint");
  const connectUrl = query.get("connectUrl");
  if (endpoint) options.endpoint = endpoint;
  if (connectUrl) options.connectUrl = connectUrl;
  return options;
}
