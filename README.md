# About graphonline

This is source code of graphonline service. Graphonline helps visualize graph and applies a lot of algorithms.

# License

MIT License.

# Development

For local viewing on macOS, see [the Mac launch instructions](docs/macos.md). Install PHP 8.4 once (`brew install php@8.4` if Homebrew is available), then open `Start GraphOnline.command` or run `bash tools/native.sh start`. Built assets are included, so viewing needs neither Node nor Docker. Docker remains available through `bash tools/local.sh start`.

Requirements: Node.js 24+, npm, and PHP 8.4 with DOM/libxml and zlib. A current browser with IndexedDB, WebAssembly and Workers supports the full editor. HTTPS (or localhost) enables offline support. The primary editor needs no database or API credentials.

```sh
npm ci
npm run check
# With PHP installed:
php -d short_open_tag=On -S 127.0.0.1:8080 -t . tools/router.php
# Or run PHP through Docker:
docker compose up
```

Built assets are committed so a PHP deployment can serve the editor without Node. After changing JS or TypeScript, run `npm run build`; CI verifies that generated assets match the sources. Do not rebuild JS using the legacy admin cache page.

```sh
npx playwright install chromium
npm run test:browser
# To test an already running server/system Chromium:
CHROMIUM_PATH=/usr/bin/chromium PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:browser
```

The test server uses `/tmp/graphonline-test-documents`. Normal document storage defaults to `tmp/saved`; PHP must be able to write there. `GRAPHONLINE_STORAGE_DIR` can select another writable directory. Legacy compressed XML remains supported within the document limits: 2 MiB of XML, 1,000 vertices and 10,000 edges. Larger documents require a separate migration. Publishing creates immutable snapshots: publishing an edited graph creates a new link. Local recovery drafts are kept in IndexedDB, including after a failed publication. PNG/SVG export happens entirely in the browser and does not require GD.

The development router is for local development. Production needs a PHP-capable web server with the routing and access controls in `.htaccess` (or equivalent configuration). Keep internal sources, Git metadata and storage execution inaccessible. Use HTTPS. Offline support currently assumes deployment at the domain root.

# Administration and legacy components

The administration interface is disabled until `GRAPHONLINE_ADMIN_PASSWORD_HASH` is configured. Generate a hash securely with PHP `password_hash`; provide it through deployment settings, never commit the password or hash. `GRAPHONLINE_ADMIN_LOGIN` defaults to `admin`. Authentication uses server-side sessions and CSRF-protected POST forms. Maintenance scripts in `backend` are CLI-only. Use `npm run build` for assets.

PmWiki and CKEditor are legacy components requiring separate upgrade and content verification. They are not included in the verified PHP 8.4 editor/API workflow. Change their default credentials before enabling them on a public deployment. The optional native CGI distributions are retained for reference; the editor uses the WebAssembly engine in a cancellable Worker on desktop and mobile.

See [the modernization plan](docs/modernization.md) for implemented changes, remaining migrations, and validation scope.
See [performance measurements and next steps](docs/performance.md) for the current bottlenecks and `npm run benchmark` instructions.
The “Arrange vertices” toolbar button runs the force layout in a cancellable Worker and creates one undoable operation. Matrix/import layout pins existing vertices. A circular preview stays usable if calculation fails; late results cannot overwrite an edited or replaced graph. `npm run benchmark -- --layout` also measures worker dispatch and completion separately.

# Additional steps to run from subdirectory:

For example you place graphonline sources into http://localhost/graph/ directory.

1. Edit .htaccess change RewriteRule to line:
```
RewriteRule ^(.*)$ /graph/index.php?q=$1 [L,QSA]
```
2. Write your directory name to script\main.js variable SiteDirs:
```
var SiteDir     = "graph/";
```
3. Write your directory to core config core\config\main.php in line SITE_IN_DIR:
```
define('SITE_IN_DIR',   'graph');
```
4. Run merge.php to apply changes. Run http://localhost/graph/script/merge.php


# JavaScript and TypeScript changes

Legacy source lives in `script`; new isolated modules live in `frontend` as TypeScript. `npm run build` produces the core/Worker bundles, deterministic entry caches and offline resource manifest. `GRAPHONLINE_USE_JS_CACHE=0` enables the source module loader for debugging. Both source and production entry paths should remain compatible.

# Fix problems

1. If you see page but css is not loaded. Maybe your web server does not support gzip encoding. You can try change FORCE_DISABLE_GZIP field from **false** to **true**. (It is placed in file /lib/ExtraPacker/ExtraPacker.php).

# Create JS algorithms without setting up a Web Server

You can open HTML file in browser to run your algorithm. Read more here sandbox/README.md.

# Offline build

You may download offline build. It is ready to run on local machine and includes tuned web server and other software. https://graphonline.ru/en/wiki/Aricles/OfflineVersion

# 3rd-party

1. Micron (http://zmicron.itkd.ru/) is our engine.
2. PmWiki (https://www.pmwiki.org/) in folders: /wiki/ and /en/wiki/
3. And others: jquery (https://jquery.com/), bootstrap5 (https://getbootstrap.com/), bootstrap icons (https://icons.getbootstrap.com/).

# Support & feedback

You can write on github to @UnickSoft or to email admin@graphonline.ru
