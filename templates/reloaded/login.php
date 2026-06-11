<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Login page of the Reloaded template. amuleweb only serves images to a
  not-yet-authenticated client, so the few Bootstrap rules this page needs
  are inlined (the original loaded Bootstrap from a CDN). amuleweb checks
  the password itself: success serves index.html; failure re-renders this
  page with "pass" still set (tested with strlen(): isset() always returns
  true in this PHP dialect).
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>aMule - Control Panel - Login</title>
	<link rel="icon" href="favicon.ico" />
	<style>
		* { box-sizing: border-box; }
		body {
			margin: 0; padding-top: 50px;
			background-color: #39425f;
			font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
			font-size: 14px;
		}
		.navbar {
			position: fixed; top: 0; left: 0; right: 0; height: 60px;
			background-color: #2f303d;
			display: flex; align-items: center; justify-content: space-between;
			padding: 0 18px; z-index: 10;
		}
		.brand { display: flex; align-items: center; gap: 8px; color: #9d9d9d; font-size: 18px; text-decoration: none; }
		.brand img { height: 40px; width: 40px; }
		form { display: flex; align-items: center; gap: 6px; margin: 0; }
		input[type=password] {
			height: 28px; padding: 4px 10px; border: 0; border-radius: 4px;
			font-size: 14px; outline: none; max-width: 44vw;
		}
		button {
			height: 30px; padding: 4px 12px; border: 0; border-radius: 4px;
			background-color: #428bca; color: #fff; cursor: pointer; font-size: 14px;
		}
		button:hover { background-color: #3071a9; }
		.logo-cont { padding: 40px 15px; text-align: center; }
		.logo-cont img { max-width: min(400px, 80vw); height: auto; }
		h1 { color: #319a9b; font-weight: 500; }
		p { color: white; }
		.err { color: #ef5350; font-weight: bold; min-height: 18px; }
		@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
		body { animation: fadeIn 1.5s; }
		@keyframes rubberBand {
			0% { transform: scale3d(1,1,1); } 30% { transform: scale3d(1.25,.75,1); }
			40% { transform: scale3d(.75,1.25,1); } 50% { transform: scale3d(1.15,.85,1); }
			65% { transform: scale3d(.95,1.05,1); } 75% { transform: scale3d(1.05,.95,1); }
			100% { transform: scale3d(1,1,1); }
		}
		.logo-cont img { animation: rubberBand 1s; }
	</style>
</head>
<body>
	<div class="navbar">
		<a class="brand" href="#"><img src="logo-nav-brax.png" alt="" /> aMule WebUI</a>
		<form action="login.php" method="post" name="login">
			<input name="pass" type="password" placeholder="Password" required autofocus />
			<button type="submit" name="submit" value="Submit" title="Log in">&#10148;</button>
		</form>
	</div>
	<div class="logo-cont">
		<img src="logo-brax.png" alt="aMule" />
		<h1>aMule Web Interface</h1>
		<p>Welcome!<br />Please login to access the complete interface!</p>
		<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
	</div>
</body>
</html>
