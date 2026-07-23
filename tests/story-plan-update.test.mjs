import assert from "node:assert/strict";
import test from "node:test";
import { classifyStoryPlanUpdate } from "../app/story-plan-update.js";

test("keeps the live story job while retrying transient status responses", () => {
  const liveJob = { status: "in_progress", jobToken: "signed-live-job" };
  const transientError = { error: "Please check again." };

  for (const status of [408, 425, 429, 503, 504]) {
    const update = classifyStoryPlanUpdate(liveJob, status, transientError);
    assert.equal(update.kind, "retry");
    assert.equal(update.result, liveJob);
  }
});

test("accepts completed updates and surfaces terminal story errors", () => {
  const liveJob = { status: "queued", jobToken: "signed-live-job" };
  const completedStory = { title: "Sam's Adventure", pages: Array(9).fill({}) };
  const terminalError = { error: "The story came back incomplete." };

  assert.deepEqual(
    classifyStoryPlanUpdate(liveJob, 200, completedStory),
    { kind: "accepted", result: completedStory },
  );
  assert.deepEqual(
    classifyStoryPlanUpdate(liveJob, 502, terminalError),
    { kind: "terminal", result: terminalError },
  );
});
