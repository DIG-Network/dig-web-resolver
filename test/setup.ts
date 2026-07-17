// jsdom lacks the blob-URL APIs; provide inert stubs so the loader's URL creation
// works under test. Individual tests spy on these where they assert calls.
import { beforeEach } from "vitest";

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-url";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => undefined;
}

beforeEach(() => {
  // Fresh page + a fresh sentinel slot for every test.
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete (window as { __digWebResolver?: unknown }).__digWebResolver;
});
