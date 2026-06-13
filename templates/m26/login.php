<!doctype html>
<!--
  SPDX-License-Identifier: GPL-2.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Reproduction of the upstream login page: a centered dialog card with the
  m26 mule icon and the password prompt, themed with the same light/dark
  variables and localStorage key as the app. The page is self-contained
  (amuleweb only serves images before authentication). amuleweb checks the
  password itself: on success it serves index.html as the body of this
  response; on failure it re-renders login.php with the submitted "pass"
  still present (isset() is unusable in this PHP dialect, presence is
  tested with strlen()).
  Origin: https://github.com/jjling2011/amule-m26
-->
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Amule M26</title>
	<link rel="icon" href="favicon.ico" />
	<meta name="theme-color" content="#2c3e50" />
	<style>
		:root {
			--bg-color: #f0e7de;
			--fg-color: black;
			--btn-color: rgb(241 226 201);
			--btn-hover: var(--bg-color);
			--sidebar-bg-color: #2c3e50;
		}
		[data-theme="dark"] {
			--bg-color: #17232f;
			--fg-color: whitesmoke;
			--btn-color: rgb(36 51 82);
			--btn-hover: rgb(77 102 152);
		}
		* { color: var(--fg-color); box-sizing: border-box; }
		body {
			margin: 0;
			font-family: Arial, sans-serif;
			background-color: var(--sidebar-bg-color);
		}
		.card {
			padding: 1.5rem;
			border-radius: 0.5rem;
			border: 1px solid gray;
			background-color: var(--bg-color);
			margin: auto;
			position: relative;
			top: 6rem;
			width: 80%;
			max-width: 25rem;
			display: flex;
			flex-direction: column;
			text-align: center;
		}
		.card img { width: 5rem; margin: 0 auto 1rem auto; }
		.row { display: flex; justify-content: center; align-items: center; margin: 0.4rem 0; }
		.row span { margin-right: 0.5rem; }
		input[type=password] {
			color: black;
			padding: 0.25rem 0.5rem;
			border-radius: 0.25rem;
			border: 1px solid gray;
		}
		input[type=submit] {
			border: 1px solid gray;
			background-color: var(--btn-color);
			color: var(--fg-color);
			padding: 0.25rem 1rem;
			border-radius: 0.5rem;
			cursor: pointer;
			min-width: 3rem;
		}
		input[type=submit]:hover { background-color: var(--btn-hover); }
		.err { color: #e74c3c; font-size: 0.85rem; min-height: 1.1rem; margin-top: 0.6rem; }
	</style>
	<script>
		(function () {
			try {
				var t = localStorage.getItem('m26-color-theme-name');
				if (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
				if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
			} catch (e) { /* ignore */ }
		})();
	</script>
</head>

<body>
	<div class="card">
		<img src="favicon.ico" alt="amule.icon" />
		<form action="login.php" method="post" name="login">
			<div class="row">
				<span>Admin</span>
				<input type="password" name="pass" autofocus />
			</div>
			<div class="row">
				<input name="submit" type="submit" value="Submit" />
			</div>
			<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
		</form>
	</div>
</body>
</html>
