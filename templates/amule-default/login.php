<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-3.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Faithful reproduction of the stock template's login page. amuleweb checks
  the password itself: on success it serves index.html as the body of this
  response; on failure it re-renders login.php with the submitted "pass"
  still present (isset() is unusable in this PHP dialect - it always returns
  true for array subscripts - so presence is tested with strlen()).
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>aMule control panel</title>
	<link rel="icon" href="favicon.ico" />
	<style>
		html, body { margin: 0; padding: 0; }
		body { background: url(fond.gif); font-family: Helvetica, Arial, sans-serif; }
		th { font-family: Helvetica; font-size: 14px; font-weight: bold; color: #003161; }
		label { font-family: "trebuchet ms", sans-serif; font-size: 12px; font-weight: bold; }
		input {
			border: 1px solid #003161; background-color: white;
			font-family: "trebuchet ms", sans-serif; font-size: 12px; color: #003161;
		}
		.wrap { width: 100%; min-height: 180px; display: flex; align-items: center; justify-content: center; padding: 40px 0; }
		.frame { width: 70%; max-width: 760px; background: #000000; padding: 1px; }
		.inner { background: #FFFFFF; display: flex; align-items: stretch; }
		.inner img.loginlogo { width: 366px; height: 180px; border: 0; display: block; flex: none; }
		.formcell {
			flex: 1 1 auto; background: url(loginfond_haut.png);
			display: flex; align-items: center; justify-content: flex-end;
			font-family: Helvetica; font-size: 14px; font-weight: bold; color: #003161;
			padding-right: 12px; min-height: 180px;
		}
		.err { color: #aa0000; font-size: 12px; min-height: 14px; text-align: right; margin-top: 6px; }
		@media (max-width: 640px) {
			.frame { width: 94%; }
			.inner { flex-direction: column; }
			.inner img.loginlogo { width: 100%; height: auto; }
			.formcell { justify-content: center; padding: 14px 8px; min-height: 0; }
		}
	</style>
</head>
<body>
	<div class="wrap">
		<div class="frame">
			<div class="inner">
				<img class="loginlogo" src="loginlogo.jpg" alt="aMule" />
				<div class="formcell">
					<form action="login.php" method="post" name="login">
						Enter password :
						<input name="pass" size="20" value="" type="password" autofocus />
						&nbsp;
						<input name="submit" type="submit" value="Submit" />
						<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
					</form>
				</div>
			</div>
		</div>
	</div>
</body>
</html>
