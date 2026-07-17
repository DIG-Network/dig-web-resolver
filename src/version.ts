/**
 * The loader's own semantic version, injected at build time from `package.json`
 * (never a hardcoded literal that could drift). Stamped into the coexistence
 * sentinel and exported for machine attribution.
 */
export const VERSION: string = __DWR_VERSION__;
