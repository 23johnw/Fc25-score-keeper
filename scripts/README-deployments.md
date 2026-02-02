# Bulk-deleting GitHub deployments

## What the script does

- Lists repo deployments (oldest first), then for each of the first N:
  1. Tries **Deployments API** `DELETE /repos/{owner}/{repo}/deployments/{id}`.
  2. If that returns 404, tries **Pages** `POST .../pages/deployments/{sha}/cancel` (using the deployment’s commit SHA).

## If everything is “skipped” (404)

For **GitHub Pages** (and many Actions-created deployments), GitHub often does **not** allow deleting those deployment records via the API:

- The Deployments API only allows deleting **inactive** deployments when there is more than one; Pages/Actions deployments may never be considered deletable, so DELETE returns 404.
- The Pages “cancel” endpoint only applies to in-progress builds; old completed deployments often 404 as well.

So the script can list 150+ deployments but every delete/cancel returns 404. That’s a **GitHub limitation**, not a bug in the script.

## What you can do

1. **Leave the list as-is**  
   The deployment list is cosmetic. It doesn’t affect your live site, quota, or billing. You can ignore it.

2. **Reduce future clutter**  
   Trigger fewer deployments (e.g. push less often, or use a branch that doesn’t deploy) so the list grows more slowly.

3. **Ask GitHub**  
   Request a way to bulk-remove or hide old deployment records: [GitHub Community](https://github.com/orgs/community/discussions) or Support (if you have an account that includes it).

There is no supported way to bulk-delete these entries when the API returns 404 for all of them.
