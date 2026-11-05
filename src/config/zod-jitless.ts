/**
 * Has to run before any module builds a Zod schema: main.tsx imports it
 * first, and vite.config.ts puts it in the vendor-zod chunk. In the entry
 * chunk it would run too late, because a chunk runs after the chunks it
 * imports, and those build their schemas as they load.
 *
 * The Content-Security-Policy in deploy/nginx.conf has no 'unsafe-eval'. Zod
 * otherwise probes `new Function` when it builds an object schema, to compile
 * a faster parser; the probe is caught, but browsers still report it as a CSP
 * violation on every page load. Interpreted parsing is fast enough for this
 * app's payloads.
 */
import * as z from 'zod'

z.config({ jitless: true })
