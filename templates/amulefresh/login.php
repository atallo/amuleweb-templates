<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Reproduction of aMuleFresh's dark login page (top navbar with the
  password field + a large centered logo). The upstream login.php loaded
  Bootstrap from a CDN; this page is fully self-contained (amuleweb only
  serves images to a not-yet-authenticated client), so the handful of
  rules it needs are inlined and rendered identically. amuleweb checks
  the password itself: on success it serves index.html as the body of
  this response; on failure it re-renders login.php with the submitted
  "pass" still present (isset() is unusable in this PHP dialect, so
  presence is tested with strlen()).
  Origin: https://github.com/dcapape/amulefresh
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>aMule - Login</title>
	<link rel="icon" href="favicon.ico" />
	<meta name="theme-color" content="#1e2028" />
	<style>
		:root {
			--bg-primary: #1a1d29;
			--bg-secondary: #252836;
			--bg-navbar: #1e2028;
			--accent-color: #076351;
			--accent-hover: #00b894;
			--text-primary: #e4e6eb;
			--text-secondary: #b0b3b8;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			padding-top: 70px;
			background-color: var(--bg-primary);
			color: var(--text-primary);
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			text-align: center;
		}
		.navbar {
			position: fixed; top: 0; left: 0; right: 0;
			display: flex; align-items: center; justify-content: space-between;
			background-color: var(--bg-navbar);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
			padding: 0.5rem 1rem;
		}
		.brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 1.2rem; }
		.brand img { height: 40px; width: 40px; }
		.login-form { display: flex; gap: 0; }
		input[type=password] {
			background-color: var(--bg-secondary);
			border: 1px solid rgba(0, 184, 148, 0.3);
			color: var(--text-primary);
			border-radius: 8px 0 0 8px;
			padding: 0.4rem 0.75rem;
			max-width: 200px;
			outline: none;
		}
		input[type=password]:focus { border-color: var(--accent-hover); }
		button {
			background-color: var(--accent-color);
			border: 1px solid var(--accent-color);
			color: #fff;
			border-radius: 0 8px 8px 0;
			padding: 0.4rem 0.9rem;
			cursor: pointer;
		}
		button:hover { background-color: var(--accent-hover); border-color: var(--accent-hover); }
		.logo-cont { padding: 60px 15px; }
		.logo-img {
			width: 280px; max-width: 70%; height: auto;
			border: 3px solid var(--accent-color);
			border-radius: 30px;
			box-shadow: 0 4px 20px rgba(0, 184, 148, 0.3);
		}
		h1 { color: var(--accent-hover); font-weight: 700; margin-top: 2rem; }
		p { color: var(--text-secondary); font-size: 1.1rem; }
		.err { color: #ff6b6b; min-height: 1.2rem; margin-top: 1rem; }
	</style>
	<script type="text/javascript">
		function login_init() { document.login.pass.focus(); }
	</script>
</head>

<body onload="login_init();">
	<nav class="navbar">
		<span class="brand"><img src="logo.png" alt="aMule Logo" /> aMule</span>
		<form class="login-form" method="post" name="login" action="login.php">
			<input name="pass" type="password" placeholder="Password" required autofocus />
			<button type="submit" name="submit" value="Submit">&#x2192;</button>
		</form>
	</nav>

	<div class="logo-cont">
		<img class="logo-img" src="logo.png" alt="aMule Logo" />
		<h1>aMule Web Interface</h1>
		<p>Welcome!<br />Please login to access the complete interface.</p>
		<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
	</div>
</body>
</html>
