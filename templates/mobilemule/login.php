<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  mobilemule login, following elbowz/mobileMule: centered icon, password
  field, "Remember me" flip switch with cookie-based autologin (note: like
  the original, remembering stores the password in a browser cookie -- only
  use it on trusted devices). amuleweb validates the password itself:
  success serves index.html, failure re-renders this page with "pass" set
  (tested via strlen(); isset() is always true in this PHP dialect).
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="theme-color" content="#545454" />
	<title>mobileMule</title>
	<link rel="icon" href="favicon.ico" />
	<style>
		* { box-sizing: border-box; }
		body {
			margin: 0; background: #f2f2f2;
			font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
			font-size: 15px; color: #222;
		}
		.wrap { max-width: 420px; margin: 0 auto; padding: 24px 16px 70px; }
		.logo { text-align: center; padding: 10px 20px 20px; }
		.logo img { width: 100%; max-width: 256px; height: auto; }
		label { display: block; font-size: 13px; color: #555; margin: 12px 0 4px; }
		input[type=password] {
			width: 100%; padding: 11px 12px; font-size: 16px;
			border: 1px solid #ccc; border-radius: 6px; background: #fff; outline: none;
		}
		input[type=password]:focus { border-color: #1976d2; }
		.row { display: flex; align-items: center; justify-content: space-between; margin: 14px 0; }
		.switch { position: relative; display: inline-block; width: 46px; height: 26px; }
		.switch input { opacity: 0; width: 0; height: 0; }
		.knob {
			position: absolute; inset: 0; border-radius: 26px;
			background: #ccc; transition: .2s; cursor: pointer;
		}
		.knob::before {
			content: ""; position: absolute; width: 22px; height: 22px; border-radius: 50%;
			left: 2px; top: 2px; background: #fff; transition: .2s;
			box-shadow: 0 1px 3px rgba(0,0,0,.3);
		}
		input:checked + .knob { background: #4caf50; }
		input:checked + .knob::before { transform: translateX(20px); }
		button {
			width: 100%; padding: 12px; font-size: 16px; border: 0; border-radius: 6px;
			background: #1976d2; color: #fff; cursor: pointer;
		}
		.err { color: #c62828; font-weight: 600; min-height: 18px; margin-top: 10px; text-align: center; }
		.footer {
			position: fixed; bottom: 0; left: 0; right: 0; height: 34px;
			background: #e8e8e8; border-top: 1px solid #d0d0d0;
			display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: #555;
		}
	</style>
</head>
<body>
	<div class="wrap">
		<div class="logo">
			<a href="https://github.com/elbowz/mobileMule" title="original project"><img src="login-icon.png" alt="mobileMule" /></a>
		</div>
		<form action="login.php" method="post" name="reg">
			<!-- force browsers to offer saving the password -->
			<input type="text" name="username" autocomplete="username" style="display:none" />
			<label for="password">Password</label>
			<input name="pass" id="password" value="" type="password" autocomplete="current-password" autofocus />
			<div class="row">
				<span>Remember me:</span>
				<label class="switch">
					<input type="checkbox" id="remember-me" />
					<span class="knob"></span>
				</label>
			</div>
			<button id="btLogin" name="submit" type="submit" value="Submit">Submit</button>
			<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
		</form>
	</div>
	<div class="footer">&nbsp;mobilemule &#169; 2026</div>

	<script>
		/* cookie helpers + autologin, following the original (quirksmode) */
		function createCookie(name, value, days) {
			var expires = "";
			if (days) {
				var date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				expires = "; expires=" + date.toGMTString();
			}
			document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Strict";
		}
		function readCookie(name) {
			var nameEQ = name + "=";
			var ca = document.cookie.split(';');
			for (var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) === ' ') c = c.substring(1);
				if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
			}
			return null;
		}
		function eraseCookie(name) { createCookie(name, "", -1); }

		var password = document.getElementById('password');
		var rememberme = document.getElementById('remember-me');
		var form = document.forms.reg;

		form.addEventListener('submit', function () {
			if (rememberme.checked) createCookie('auth', password.value, 365);
			else eraseCookie('auth');
		});

		// Autologin (skipped right after a failed attempt to avoid a loop)
		var failed = <?php echo (strlen($HTTP_GET_VARS["pass"]) > 0) ? "true" : "false"; ?>;
		var authCookie = readCookie('auth');
		if (authCookie && !failed) {
			rememberme.checked = true;
			password.value = authCookie;
			form.submit();
		}
	</script>
</body>
</html>
