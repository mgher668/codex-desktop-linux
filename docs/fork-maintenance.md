# Maintaining This Fork

This repository may carry local Linux patches that are not accepted upstream,
such as the niri Computer Use window backend. Keep those patches on a long-lived
fork branch and regularly replay them on top of upstream `main`.

The examples below assume this remote layout:

```bash
origin   git@github.com:mgher668/codex-desktop-linux.git
upstream https://github.com/ilysenko/codex-desktop-linux.git
```

And this local maintenance branch:

```bash
add-niri-window-backend
```

## Routine Update

Start by fetching both remotes and making sure the worktree is clean:

```bash
git fetch upstream
git fetch origin
git switch add-niri-window-backend
git status -sb
```

Replay the local branch on top of the latest upstream `main`:

```bash
git rebase upstream/main
```

If there are conflicts, resolve the files, then continue:

```bash
git add <resolved-files>
git rebase --continue
```

If the rebase is going in the wrong direction, stop before making more changes:

```bash
git rebase --abort
```

## Verify After Rebase

Run the focused checks for the Linux patching and Computer Use windowing code:

```bash
node --test scripts/patch-linux-window-ui.test.js
cargo fmt --check
cargo test -p codex-computer-use-linux windowing::
```

For a full local app rebuild, regenerate `codex-app/` and launch it:

```bash
./install.sh
./codex-app/start.sh
```

## Push The Rebased Branch

After a successful rebase, normal `git push` may be rejected with a
non-fast-forward error. That is expected: rebase rewrites commit IDs, so the
remote branch still contains the old versions of the local commits.

Push the rewritten branch with a lease:

```bash
git push --force-with-lease origin add-niri-window-backend
```

Prefer `--force-with-lease` over `--force`. The lease refuses to overwrite the
remote branch if it changed since the last fetch.

## When Push Is Rejected

Inspect the divergence before deciding what to do:

```bash
git fetch origin
git status -sb
git log --oneline --left-right HEAD...origin/add-niri-window-backend
```

If the right side only contains old pre-rebase commits from this same branch,
replace the remote branch:

```bash
git push --force-with-lease origin add-niri-window-backend
```

If the right side contains new work from another machine or another person,
inspect it first instead of overwriting it.

## Avoid Blind Pulls

Do not run a blind `git pull` on this maintenance branch after rebasing. It can
merge the old remote commits back into the branch and make the history harder to
understand.

Use this pattern instead:

```bash
git fetch upstream
git fetch origin
git rebase upstream/main
git push --force-with-lease origin add-niri-window-backend
```

If you do not want to rewrite history, use a merge workflow instead:

```bash
git fetch upstream
git fetch origin
git switch add-niri-window-backend
git merge upstream/main
git push origin add-niri-window-backend
```

The merge workflow avoids force-pushing, but it keeps merge commits in the
maintenance branch history.
