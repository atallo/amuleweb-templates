<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU General Public License as published by the
  Free Software Foundation, either version 3 of the License, or (at your
  option) any later version. See the LICENSE file for details.
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="color-scheme" content="light dark" />
	<title>aMule — Sign in</title>
	<link rel="icon" href="favicon.ico" />
	<!--
		amuleweb only serves images to a not-yet-authenticated client, so the
		login page cannot rely on app.css — its styles are inlined here. The
		only external reference is the logo image.
	-->
	<style>
		:root {
			--bg:#f4f5f7; --surface:#fff; --border:#e3e6ea; --border-2:#d4d8de;
			--text:#1b1f24; --muted:#6b7280; --accent:#2d7ff9; --accent-bg:#eaf2ff;
			--danger:#dc2626; --radius:7px; --radius-sm:5px;
			--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
		}
		@media (prefers-color-scheme: dark) {
			:root {
				--bg:#15171b; --surface:#1d2025; --border:#2c313a; --border-2:#3a404b;
				--text:#e6e9ee; --muted:#9aa1ab; --accent:#4c9bff; --accent-bg:#1a2c47; --danger:#f87171;
			}
		}
		* { box-sizing:border-box; }
		body {
			margin:0; min-height:100vh; min-height:100dvh; display:flex; align-items:center;
			justify-content:center; padding:20px; background:var(--bg); color:var(--text);
			font-family:var(--font); font-size:13px;
		}
		.login-card {
			width:100%; max-width:340px; background:var(--surface); border:1px solid var(--border);
			border-radius:var(--radius); box-shadow:0 1px 3px rgba(16,24,40,.1); padding:28px 26px; text-align:center;
		}
		.login-card img { height:40px; width:auto; margin-bottom:16px; }
		.login-card h1 { font-size:16px; margin:0 0 4px; }
		.login-card p { color:var(--muted); margin:0 0 20px; font-size:12px; }
		form { display:flex; flex-direction:column; gap:12px; }
		input {
			width:100%; text-align:center; padding:10px; font:inherit; color:var(--text);
			background:var(--surface); border:1px solid var(--border-2); border-radius:var(--radius-sm); outline:none;
		}
		input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-bg); }
		button {
			width:100%; padding:10px; font:inherit; font-weight:500; color:#fff; cursor:pointer;
			background:var(--accent); border:1px solid var(--accent); border-radius:var(--radius-sm);
		}
		button:hover { filter:brightness(1.05); }
		.login-err { color:var(--danger); font-size:12px; min-height:16px; }
	</style>
</head>
<body>
	<div class="login-card">
		<img src="logo.png" alt="aMule" />
		<h1>aMule Web Control</h1>
		<p>Enter the web interface password</p>
		<!--
			amuleweb checks the password itself. On success it serves index.html
			(the app); on failure it re-renders login.php with the submitted
			"pass" still present, so we can show an error. Must be POST: amuleweb
			refuses a password in the URL query string.
		-->
		<form method="post" action="login.php" name="login">
			<input type="password" name="pass" placeholder="Password" autofocus autocomplete="current-password" />
			<button type="submit">Sign in</button>
			<!--
				isset() can't be used here: in amuleweb's PHP, isset() on an
				array subscript always returns true (evaluating the argument
				auto-creates the element). strlen() of an absent parameter is
				0, so test the length instead.
			-->
			<div class="login-err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password — try again."; } ?></div>
		</form>
	</div>
</body>
</html>
