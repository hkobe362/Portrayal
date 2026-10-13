### Fixed
- The merge train reads a review comment that starts with the worker's task id
  in brackets, such as `[P-0012] REVIEW: approve`, as a verdict. Only trusted
  commenters count and the review must still be newer than the head commit.
  `OWNER DECISION:` is posted without an id and is matched as before (#1062).
