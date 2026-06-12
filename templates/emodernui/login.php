<!doctype html>
<!--
  SPDX-License-Identifier: GPL-2.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Reproduction of the upstream login.html (centered logo + password form,
  Bootswatch "Flatly" look) with the aMule logo instead of the eMule one
  (the upstream prototype references a logo.jpg that is not part of its
  repository). The page is self-contained — amuleweb only serves images
  to a not-yet-authenticated client — so the handful of Flatly rules the
  form uses are inlined. amuleweb checks the password itself: on success
  it serves index.html as the body of this response; on failure it
  re-renders login.php with the submitted "pass" still present (isset()
  is unusable in this PHP dialect, presence is tested with strlen()).
  Origin: https://github.com/vincenzo-petronio/eMuleModernUI
-->
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>aMule - Web Control</title>
	<link rel="shortcut icon" href="favicon.ico" />
	<link rel="apple-touch-icon" href="apple-touch-icon.png" />
	<meta name="theme-color" content="#2c3e50" />
	<style>
		/* minimal Bootswatch Flatly 3.1.1 subset */
		*, *::before, *::after { box-sizing: border-box; }
		body {
			margin: 0;
			padding-top: 50px;
			padding-bottom: 20px;
			font-family: "Lato", "Helvetica Neue", Helvetica, Arial, sans-serif;
			font-size: 15px;
			line-height: 1.42857143;
			color: #2c3e50;
			background-color: #ffffff;
			text-align: center;
		}
		.box { max-width: 360px; margin: 0 auto; padding: 10px; }
		h2 { font-weight: 400; margin: 10px 0 20px 0; }
		img.logo { max-width: 100%; height: auto; }
		label { display: block; font-weight: bold; margin: 14px 0 6px 0; }
		input[type=password] {
			display: block;
			width: 100%;
			height: 45px;
			padding: 10px 15px;
			font-size: 15px;
			color: #2c3e50;
			background-color: #ffffff;
			border: 2px solid #dce4ec;
			border-radius: 4px;
		}
		input[type=password]:focus { border-color: #2c3e50; outline: 0; }
		.btn {
			display: inline-block;
			margin-top: 16px;
			padding: 10px 15px;
			font-size: 15px;
			font-weight: normal;
			color: #ffffff;
			background-color: #95a5a6;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}
		.btn:hover { background-color: #798d8f; }
		.err { color: #e74c3c; font-size: 13px; min-height: 18px; margin-top: 12px; }
		footer { text-align: right; padding: 10px; color: #b4bcc2; }
	</style>
</head>

<body>
	<div class="box">
		<div><h2>Login Web Control</h2></div>
		<div>
			<a href="https://www.amule.org" target="_blank" rel="noopener"><img class="logo" src="logo.png" alt="aMule-Project" /></a>
		</div>
		<div>
			<form method="post" name="login" role="form" action="login.php">
				<label for="psw">Enter your password</label>
				<input type="password" id="psw" name="pass" maxlength="40" value="" autofocus />
				<button type="submit" class="btn" name="submit">Login now</button>
				<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
			</form>
		</div>
	</div>
	<footer><p>2026</p></footer>
</body>
</html>
