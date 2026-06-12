<!DOCTYPE html>
<!--
  SPDX-License-Identifier: GPL-2.0-or-later
  Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

  Reproduction of the flattened template's minimalist login page (plain
  centered text on the tiled background, no logo image). amuleweb checks
  the password itself: on success it serves index.html as the body of this
  response; on failure it re-renders login.php with the submitted "pass"
  still present (isset() is unusable in this PHP dialect - it always returns
  true for array subscripts - so presence is tested with strlen()).
  Origin: https://github.com/marcellozaniboni/amuleweb-flattened-template
-->
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>aMule control panel</title>
	<link rel="icon" href="favicon.ico" />
	<style>
		html, body { margin: 0; padding: 0; }
		body {
			background: url(fond.gif);
			font-family: Arial, Helvetica, sans-serif;
			font-size: 16px;
			text-align: center;
		}
		h1 {
			margin: 90px 0 24px 0;
			font-size: 22px;
			font-weight: bold;
			color: #003161;
		}
		h1 span { display: block; font-weight: normal; }
		input {
			border: 1px solid #003161; background-color: white;
			font-family: "trebuchet ms", sans-serif; font-size: 12px; color: #003161;
		}
		.err { color: #aa0000; font-size: 12px; min-height: 14px; margin-top: 10px; }
	</style>
</head>
<body>
	<h1>aMuleWeb<span>authentication</span></h1>
	<form action="login.php" method="post" name="login">
		Enter password:
		<input name="pass" size="20" value="" type="password" autofocus />
		&nbsp;
		<input name="submit" type="submit" value="Submit" />
		<div class="err"><?php if (strlen($HTTP_GET_VARS["pass"]) > 0) { echo "Incorrect password - try again."; } ?></div>
	</form>
</body>
</html>
