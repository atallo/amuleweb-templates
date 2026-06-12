<!doctype html>
<!--
  SPDX-License-Identifier: GPL-2.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Reproduction of the upstream template's Bootstrap "sign-in" login page.
  The upstream login.php inlines the whole 160 KB of Bootstrap; this page
  inlines only the handful of rules the sign-in form actually uses, with
  identical rendering (login.php must be self-contained: amuleweb only
  serves images to a not-yet-authenticated client). amuleweb checks the
  password itself: on success it serves index.html as the body of this
  response; on failure it re-renders login.php with the submitted "pass"
  still present (isset() is unusable in this PHP dialect - it always
  returns true for array subscripts - presence is tested with strlen()).
  Origin: https://github.com/pedro77/amuleweb-bootstrap-template
-->
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
	<title>aMule Web - Login</title>
	<link rel="apple-touch-icon" href="apple-touch-icon.png" sizes="180x180" />
	<link rel="icon" href="favicon-32x32.png" sizes="32x32" type="image/png" />
	<link rel="icon" href="favicon-16x16.png" sizes="16x16" type="image/png" />
	<link rel="icon" href="favicon.ico" />
	<meta name="theme-color" content="#563d7c" />
	<style>
		/* minimal Bootstrap 4 subset + the upstream signin.css */
		*, *::before, *::after { box-sizing: border-box; }
		html, body { height: 100%; }
		body {
			margin: 0;
			display: flex;
			align-items: center;
			padding-top: 40px;
			padding-bottom: 40px;
			background-color: #f5f5f5;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
				"Helvetica Neue", Arial, sans-serif;
			font-size: 1rem;
			line-height: 1.5;
			color: #212529;
			text-align: center;
		}
		.form-signin { width: 100%; max-width: 330px; padding: 15px; margin: auto; }
		.form-signin .form-control {
			position: relative;
			box-sizing: border-box;
			height: auto;
			padding: 10px;
			font-size: 16px;
		}
		.form-signin .form-control:focus { z-index: 2; }
		.form-signin input[type=password] {
			margin-bottom: 10px;
			border-top-left-radius: 0;
			border-top-right-radius: 0;
		}
		h1 { font-size: 1.75rem; font-weight: 400; margin: 0 0 1rem 0; }
		.mb-4 { margin-bottom: 1.5rem; }
		.form-control {
			display: block;
			width: 100%;
			font-weight: 400;
			line-height: 1.5;
			color: #495057;
			background-color: #fff;
			border: 1px solid #ced4da;
			border-radius: .25rem;
		}
		.btn {
			display: inline-block;
			width: 100%;
			font-weight: 400;
			text-align: center;
			vertical-align: middle;
			user-select: none;
			padding: .5rem 1rem;
			font-size: 1.25rem;
			line-height: 1.5;
			border-radius: .3rem;
			border: 1px solid transparent;
			cursor: pointer;
		}
		.btn-primary { color: #fff; background-color: #007bff; border-color: #007bff; }
		.btn-primary:hover { background-color: #0069d9; border-color: #0062cc; }
		.sr-only {
			position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
			overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
		}
		.err { color: #dc3545; font-size: .875rem; min-height: 1.2rem; margin-top: .75rem; }
	</style>
</head>

<body>
<form action="login.php" class="form-signin" method="post" id="login" name="login">
	<img class="mb-4" src="EMule_mascot.png" alt="aMule" width="55" height="72" />
	<h1>aMule Web</h1>
	<label for="inputPassword" class="sr-only">Password</label>
	<input type="password" id="inputPassword" name="pass" class="form-control" placeholder="Password" required autofocus />
	<button class="btn btn-primary" type="submit" name="submit">Login</button>
	<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
</form>
</body>
</html>
