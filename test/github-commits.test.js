const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  countCommitsFromPushEvents,
  buildCommitSearchQuery,
  repoFullNameFromIssue,
} = require("../src/github");

describe("commit counting helpers", () => {
  it("builds an all-time author search query by default", () => {
    assert.equal(buildCommitSearchQuery("developer-az"), "author:developer-az");
  });

  it("adds author-date bounds when a window is requested", () => {
    assert.equal(
      buildCommitSearchQuery("ada", { since: "2026-08-04", until: "2026-08-10" }),
      "author:ada author-date:2026-08-04..2026-08-10"
    );
  });

  it("prefers distinct_size over truncated commits arrays", () => {
    const total = countCommitsFromPushEvents([
      {
        type: "PushEvent",
        payload: { distinct_size: 25, size: 25, commits: [{}, {}] },
      },
      { type: "WatchEvent", payload: {} },
      { type: "PushEvent", payload: { size: 3, commits: [] } },
      { type: "PushEvent", payload: { commits: [{}, {}, {}, {}] } },
    ]);
    assert.equal(total, 25 + 3 + 4);
  });

  it("returns 0 when public payloads omit commit fields (GitHub redaction)", () => {
    const total = countCommitsFromPushEvents([
      {
        type: "PushEvent",
        payload: {
          repository_id: 1,
          push_id: 2,
          ref: "refs/heads/main",
          head: "abc",
          before: "def",
        },
      },
    ]);
    assert.equal(total, 0);
  });

  it("parses owner/repo from issue search repository_url", () => {
    assert.equal(
      repoFullNameFromIssue({
        repository_url: "https://api.github.com/repos/kevinanielsen/go-fast-cdn",
      }),
      "kevinanielsen/go-fast-cdn"
    );
    assert.equal(repoFullNameFromIssue({}), "");
  });
});
