// Single source of truth for the build version — bump with every
// user-visible change. Loaded two ways: as a classic script by the page
// (sets it on window) and via importScripts by the service worker (sets
// it on the worker's global). The SW cache name derives from it, so a
// bump also retires the old cache. Shown in the app footer so "which
// build are you on?" is answerable from a phone screenshot.
self.APP_VERSION = "1.7.0";
