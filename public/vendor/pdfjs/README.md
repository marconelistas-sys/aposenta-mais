PDF.js 5.4.624, legacy browser build from the pdfjs-dist npm package.
Source: https://github.com/mozilla/pdf.js
License: Apache-2.0, included in LICENSE.

The library and its worker are served locally. Statement bytes are never sent
to a third-party PDF service. The legacy build includes compatibility polyfills.
To update, copy legacy/build/pdf.min.mjs, legacy/build/pdf.worker.min.mjs and
LICENSE from a reviewed pdfjs-dist release, then verify statement import.

The upstream .mjs files are renamed to .js when vendored. Keep both local
filenames and the loader paths in statement-file.js in sync. This lets servers
started before .mjs support was added serve the reader and module worker with
the required JavaScript Content-Type, without restarting an active session.
