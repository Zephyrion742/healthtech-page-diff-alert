import assert from "node:assert/strict";
import { pageChanged } from "./appointment-page-monitor.ts";

assert.equal(pageChanged("  Tuesday  9:00  ", "Tuesday 9:00"), false);
assert.equal(pageChanged("Tuesday 9:00", "Wednesday 9:00"), true);
console.log("pageChanged keeps formatting-only edits quiet and flags an appointment change.");
