# Admin feature ownership

Add `screens.js` and `actions.js` here for Admin Dashboard, Service Management, and Queue Management. Avoid editing the user feature files. Register admin routes in `src/app.js` and use an account `role` (`user` or `admin`) to select the proper navigation and default page. Do not expose admin actions merely by hiding links; real authorization belongs in the A3 backend.

Use service IDs from `src/data/services.js`. Coordinate service creation and queue mutations through `src/data/store.js` (or a shared API replacement in A3), so user and admin views read the same source. Agree on the data shape before implementation; see `docs/TEAM_INTEGRATION.md`.
