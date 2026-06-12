<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Login page in the amule.org-website style (brand hero gradient, centered
  card). amuleweb only serves images before authentication, so all CSS is
  inline. The password is checked by amuleweb itself: success serves
  index.html, failure re-renders this page with "pass" still set
  (presence tested with strlen(); isset() is always true in this dialect).
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="color-scheme" content="light dark" />
	<meta name="theme-color" content="#235787" />
	<title>aMule — Sign in</title>
	<link rel="icon" href="favicon.ico" />
	<style>
		:root {
			--brand: #3d7ebe; --brand-dark: #2f6fac; --brand-darkest: #235787;
			--surface: #ffffff; --text: #1c1e21; --muted: #606770;
			--border: #dadde1; --danger: #fa383e;
		}
		@media (prefers-color-scheme: dark) {
			:root { --surface: #242526; --text: #e3e3e3; --muted: #a8aeb5; --border: #3c3d40; }
		}
		* { box-sizing: border-box; }
		body {
			margin: 0; min-height: 100vh; min-height: 100dvh;
			display: flex; align-items: center; justify-content: center; padding: 20px;
			background: linear-gradient(135deg, var(--brand-darkest), var(--brand-dark) 55%, var(--brand));
			font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif;
			font-size: 15px;
		}
		.card {
			width: 100%; max-width: 360px;
			background: var(--surface); color: var(--text);
			border-radius: 14px; padding: 30px 28px;
			box-shadow: 0 8px 40px rgba(0,0,0,.35);
			text-align: center;
		}
		.card img { height: 56px; width: auto; margin-bottom: 12px; }
		h1 { font-size: 19px; margin: 0 0 4px; }
		p { color: var(--muted); margin: 0 0 20px; font-size: 13px; }
		form { display: flex; flex-direction: column; gap: 12px; }
		input {
			width: 100%; padding: 11px 12px; font-size: 16px; text-align: center;
			color: var(--text); background: transparent;
			border: 1px solid var(--border); border-radius: 8px; outline: none;
		}
		input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(61,126,190,.25); }
		button {
			width: 100%; padding: 11px; font-size: 15px; font-weight: 700;
			color: #fff; background: var(--brand); border: 0; border-radius: 8px; cursor: pointer;
		}
		button:hover { background: var(--brand-dark); }
		.err { color: var(--danger); font-size: 13px; min-height: 18px; font-weight: 600; }
	</style>
</head>
<body>
	<div class="card">
		<img src="logo.png" alt="aMule" />
		<h1>aMule control panel</h1>
		<p>Enter the web interface password</p>
		<form action="login.php" method="post" name="login">
			<input name="pass" type="password" placeholder="Password" autofocus autocomplete="current-password" />
			<button type="submit">Sign in</button>
			<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
		</form>
	</div>
</body>
</html>
