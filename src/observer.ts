/**
 * The MutationObserver that keeps a dynamic page resolved: any node added later,
 * any watched attribute changed, or any `<style>` text edited is re-scanned. It
 * watches ONLY the attributes that can carry a DIG reference, and the scanner's
 * own guards (§scanner) make re-observing a just-resolved node a no-op.
 */
import { scanSubtree } from "./scanner";

/** The attributes worth reacting to — the union of every scanned attribute. */
const WATCHED_ATTRIBUTES = ["src", "srcset", "href", "poster", "style", "rel"];

/** Start observing `root`; returns the observer so the caller can disconnect it. */
export function startObserver(root: Node = document): MutationObserver {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scanSubtree(node);
        });
      } else if (record.type === "attributes" && record.target instanceof Element) {
        scanSubtree(record.target);
      } else if (record.type === "characterData") {
        const parent = record.target.parentElement;
        if (parent) scanSubtree(parent);
      }
    }
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: WATCHED_ATTRIBUTES,
    characterData: true,
  });
  return observer;
}
