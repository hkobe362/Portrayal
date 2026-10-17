### Changed
- A pull request that changes `kit/` no longer bumps the kit version; it adds a changelog fragment only. The version in `kit/package.json` and the README's "New in" note are set once, when the kit is published, and `spec/tools/portrayal/kitrelease.py --publish` refuses a publish where the two disagree. The test that pinned the version is gone. No library or kit change.
