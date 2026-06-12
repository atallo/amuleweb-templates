# amuleweb's embedded PHP: limitations and bugs that shaped `api.php`

amuleweb does not embed real PHP. It ships its own tiny interpreter of a
PHP-like dialect (`src/webserver/src/php_*` in the aMule sources), and
[`common/api.php`](../common/api.php) runs inside it. Everything below was
hit — and verified against a live amuleweb — while building the JSON layer.
Keep this page open if you ever need to touch `api.php`.

## Missing standard library

1. **No `json_encode`** (and no `sprintf` / `number_format`). All JSON is
   emitted by hand with `echo` and a comma flag per loop. One stray comma or
   an unquoted string invalidates the whole response.
2. **No string functions usable for escaping**: there is no `str_replace`,
   `substr`, `preg_replace`, `addslashes` or `htmlspecialchars`. The whole
   callable surface is roughly `strlen`, `count`, `isset`, `usort`,
   `split` (POSIX ERE) plus the `amule_*` host API, `$_SESSION` and
   `$HTTP_GET_VARS`. The JSON string escaper (`jesc()`) is therefore built
   out of `split()` + manual re-joining, one pass per escaped character.
3. **No `include` / `require`.** Helpers cannot be shared between files, so
   `api.php` is a single self-contained file. (This is also why the stock
   templates re-declare `CastToXBytes()` on every page.)

## Interpreter bugs

4. **`split()` APPENDS to its result variable instead of replacing it.**
   Chaining escape passes that reuse one variable makes each call accumulate
   the previous content — output grows exponentially (a 3-byte string once
   ballooned into a 475 KB response). *Workaround:* reset the target to a
   scalar right before every call:

   ```php
   $p = 0; $p = split("\n", $s);   // never just  $p = split(...)
   ```

5. **A user function cannot reliably call another user function** — local
   variables get corrupted across nested calls (verified with live probes).
   `jesc()` is fully self-contained and only ever called from top-level
   code. Corollary: **no recursion**; the `statstree` route emits the
   statistics tree with six hand-unrolled `foreach` levels instead of a
   recursive walker.
6. **`split()` destroys non-ASCII subjects.** The wxRegEx build converts
   the subject string with the *process locale*; in a C-locale container
   (typical for Docker) any `ñ`/accented byte makes the conversion fail and
   every pass returns the empty string. Symptom: the escaper silently wiped
   every file name containing non-ASCII characters — the stock template
   never escapes anything, which is why it was unaffected. *Workarounds:*
   `jesc()` falls back to emitting the original bytes when escaping returns
   empty for non-empty input, and `log` / `serverinfo` are served as
   **plain text** routes that never pass through `jesc()`.
7. **The `"\r"` escape does not exist in the lexer** — it parses as a
   literal `r`, so a CR-escaping pass corrupted ordinary words
   (`normal` → `no\rmal`). Only `\\`, `\"`, `\n` and `\t` are escaped.
8. **String indexing crashes the interpreter.** `$s[$i]` hangs the request
   (empty HTTP reply), so character-by-character processing is impossible.
9. **Regex character classes containing a backslash can hang `split()`**
   (`split("[\"\\\\]", …)` never returns — most likely an empty-match
   loop). Only single-character patterns are safe; hence one pass per
   escaped character.
10. **`isset()` on an array subscript always returns true** — evaluating
    the argument auto-creates the element. This made the login page show
    "Incorrect password" on a fresh GET. *Workaround:* test presence with
    `strlen($x) > 0` (an absent parameter has length 0).

## Traps in the `amule_*` native bridge

11. **Rigid and inconsistent parameter typing.**
    `amule_do_ed2k_download_cmd` and `amule_do_search_download_cmd` require
    the *category* argument to be of **string** type: pass an int
    (`$x + 0`) and the C side returns silently without ever sending the EC
    packet — downloads simply never start, while the page still renders.
    The opposite trap exists too: the optional 3rd argument (priority) of
    `amule_do_shared_cmd` / `amule_do_download_cmd` is read as `int_val`
    **without casting**, so there it must be an int. Force the right type
    per call:

    ```php
    $cat  = "" . $HTTP_GET_VARS["cat"];   // string, for the two add commands
    $prio = $HTTP_GET_VARS["prio"] + 0;   // int, for the priority argument
    ```

12. **No error feedback anywhere.** `php_report_error()` goes to amuleweb's
    stderr (invisible remotely), the HTTP status is 200 regardless, and the
    write commands use fire-and-forget EC requests whose replies amuleweb
    discards. An `{"ok":true}` from `api.php` only means *attempted*.
    Debugging realistically means dropping a small probe `.php` next to the
    template and reading the aMule log.

## The web server itself

16. **amuleweb is single-threaded — two simultaneous requests can stall
    it.** Observed live while debugging: firing a second API call before
    the first one had answered made responses queue up and, under a little
    pressure (e.g. two pollers or parallel `curl`s), the server stopped
    answering until the requests timed out. This is a property of amuleweb,
    not of the PHP dialect, but it dictates how the API must be consumed:
    **every template in this repository funnels all `fetch` calls through a
    single-flight serialized queue** (never more than one request in
    flight) and skips a polling cycle entirely while the previous one is
    still running. If you write your own client, do the same; also note
    that the browser fetches the `dyn_<hash>.png` chunk bars and
    `amule_stats_*.png` graphs in parallel on its own, which amuleweb
    tolerates because they are tiny — keep API polling serialized anyway.

## Structural constraints

13. **Anything outside `<?php ?>` is sent to the client**, so `api.php` is
    one single PHP block to keep responses pure JSON (the trailing newline
    after `?>` is tolerated by `JSON.parse`).
14. **No header or status-code control.** `.php` responses are always
    `text/html` and 200; errors must travel in-band
    (`{"ok":false,"error":…}`). Real `application/json` is only available
    for actual `.json` files (which is why the PWA manifests are static
    files).
15. **Float formatting is the interpreter's choice** (variable number of
    decimals), so the API ships raw numbers and all formatting happens
    client-side.

## Practical advice

* Pattern for every `split()` call: reset first (`$p = 0;`), single-char
  pattern, fresh accumulator, no helper calls inside the loop.
* When adding a route, echo numbers with `($x + 0)` and strings through
  `jesc()`; never interpolate user input into structure.
* Test against a real amuleweb early: `curl --compressed` with a cookie jar
  (the session cookie rotates on login), then `api.php?r=...`. The mock
  preview cannot catch interpreter-level issues.
* When a write command "succeeds" but nothing happens, suspect parameter
  types (see 11) and check the aMule log right after resetting it.
