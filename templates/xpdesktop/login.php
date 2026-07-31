<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Windows XP "Luna" login dialog. Self-contained (amuleweb only serves images
  to a not-yet-authenticated client). amuleweb checks the password itself; on
  failure it re-renders this page with the submitted "pass" present (isset()
  is unusable in this PHP dialect, so presence is tested with strlen()).
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
	<meta http-equiv="Pragma" content="no-cache" />
	<meta http-equiv="Expires" content="0" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>aMule</title>
	<link rel="icon" href="favicon.ico" />
	<style>
		* { box-sizing: border-box; }
		html, body { margin: 0; height: 100%; }
		body {
			font-family: Tahoma, "Segoe UI", sans-serif; font-size: 11px;
			background: linear-gradient(180deg, #5a8ed6 0%, #3f6fb5 45%, #2e6b3e 70%, #4a8c3a 100%);
			display: flex; align-items: center; justify-content: center;
		}
		.dlg { width: 320px; background: #ece9d8; border: 3px solid #0831d9; border-radius: 8px 8px 6px 6px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); overflow: hidden; }
		.title {
			height: 28px; display: flex; align-items: center; gap: 6px; padding: 0 6px;
			background: linear-gradient(180deg,#3f9bfd 0%,#1471ee 8%,#0d5ae8 16%,#0c52e0 45%,#0c4fdb 82%,#4083f0 100%);
		}
		.title img { width: 16px; height: 16px; }
		.title span { font-family: "Trebuchet MS", Tahoma, sans-serif; font-weight: bold; font-size: 12px; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.45); }
		.body { padding: 18px 16px; text-align: center; }
		.body img.logo { width: 48px; height: 48px; }
		.body h2 { margin: 8px 0 2px; font-size: 14px; }
		.body p { margin: 0 0 14px; color: #444; }
		.field { display: flex; align-items: center; gap: 6px; justify-content: center; }
		input[type=password] { height: 20px; width: 150px; border: 1px solid #7f9db9; padding: 1px 4px; font: inherit; }
		input[type=submit] {
			min-height: 22px; padding: 1px 16px; font: inherit; cursor: pointer; border: 2px solid #1c5fd0;
			border-radius: 3px; font-weight: bold;
			background: linear-gradient(180deg, #fefefe 0%, #f0efe9 48%, #dcd8c8 52%, #e9e6da 100%);
		}
		input[type=submit]:hover { border-color: #2d6fd8; background: linear-gradient(180deg,#fff,#eaf2fd 52%,#d6e6fb); }
		.err { color: #c00; min-height: 14px; margin-top: 10px; }
	</style>
	<script>function f(){document.login.pass.focus();}</script>
</head>
<body onload="f();">
	<div class="dlg">
		<div class="title"><img src="logo.png" alt="" /><span>aMule — Log On</span></div>
		<div class="body">
			<img class="logo" src="logo.png" alt="aMule" />
			<h2>aMule</h2>
			<p>Enter your web interface password</p>
			<form action="login.php" method="post" name="login">
				<div class="field">
					<input name="pass" type="password" value="" autofocus />
					<input name="submit" type="submit" value="Log On" />
				</div>
				<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
			</form>
		</div>
	</div>
</body>
</html>
