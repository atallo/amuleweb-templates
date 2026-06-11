<?php
//
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 3 of the License, or (at your
// option) any later version. See the LICENSE file for details.
//
//
// api.php -- JSON service layer for the minimalist aMule web skin.
//
// Runs inside amuleweb's embedded PHP interpreter, a tiny dialect with sharp
// edges (all verified against a live server):
//   * builtins: strlen, count, isset, usort, split (regex) + the amule_* host
//     API + $_SESSION / $HTTP_GET_VARS. No json_encode/str_replace/substr/etc.,
//     no include.
//   * split() APPENDS to its result variable, so every split target is reset to
//     a scalar (`$p = 0;`) right before use.
//   * a user function must not call another user function (locals get corrupted)
//     and recursion is out -- so jesc() is fully self-contained and is only ever
//     called from top-level code (top-level foreach/echo is fine).
//   * the "\r" string escape is unsupported (becomes the letter r); only
//     \\ \" \n \t are escaped. Bare CR in data is vanishingly rare here.
//
// The whole file is one PHP block, so the body is pure JSON (surrounding
// whitespace is tolerated by JSON.parse). $HTTP_GET_VARS merges GET + POST.
//

// --------------------------------------------------------------------
// jesc($s): return $s escaped for use inside a JSON double-quoted string.
// Four sequential split/join passes; each split goes into a freshly reset
// variable. No helper calls, no recursion.
// --------------------------------------------------------------------
function jesc($s)
{
	$p = 0; $p = split("\\\\", $s); $o = ""; $i = 0; foreach ($p as $x) { if ($i != 0) { $o = $o . "\\\\"; } $o = $o . $x; $i = 1; }
	$p = 0; $p = split("\"",   $o); $r = ""; $i = 0; foreach ($p as $x) { if ($i != 0) { $r = $r . "\\\""; } $r = $r . $x; $i = 1; }
	$p = 0; $p = split("\n",   $r); $o = ""; $i = 0; foreach ($p as $x) { if ($i != 0) { $o = $o . "\\n";  } $o = $o . $x; $i = 1; }
	$p = 0; $p = split("\t",   $o); $r = ""; $i = 0; foreach ($p as $x) { if ($i != 0) { $r = $r . "\\t";  } $r = $r . $x; $i = 1; }
	// split() converts its SUBJECT with the process locale (wxRegEx build);
	// in a C-locale container any non-ASCII byte makes that conversion fail
	// and every pass above yields "". Escaping never shrinks a string to
	// nothing, so empty-out + non-empty-in means the passes were lossy:
	// return the original bytes untouched instead -- which is exactly what
	// the stock template does (it never escapes). Such names are valid in
	// JSON unless they also contain a quote/backslash, which is virtually
	// unheard of in ed2k names.
	if (strlen($r) == 0) { return $s; }
	return $r;
}

// --------------------------------------------------------------------
// Request dispatch (all top-level)
// --------------------------------------------------------------------

$r = $HTTP_GET_VARS["r"];
$guest = $_SESSION["guest_login"];

//
// ---- status --------------------------------------------------------
//
if ($r == "status") {
	$s = amule_get_stats();
	$id = $s["id"];
	$ed2k_state = "disconnected";
	$lowid = 0;
	if ($id == 4294967295) {
		$ed2k_state = "connecting";
	} elseif ($id != 0) {
		$ed2k_state = "connected";
		if ($id < 16777216) { $lowid = 1; }
	}
	echo "{";
	echo "\"version\":\"", jesc(amule_get_version()), "\"";
	echo ",\"guest\":", ($guest != 0) ? "true" : "false";
	echo ",\"auto_refresh\":", ($_SESSION["auto_refresh"] + 0);
	echo ",\"speed_down\":", ($s["speed_down"] + 0);
	echo ",\"speed_up\":", ($s["speed_up"] + 0);
	echo ",\"speed_limit_down\":", ($s["speed_limit_down"] + 0);
	echo ",\"speed_limit_up\":", ($s["speed_limit_up"] + 0);
	echo ",\"ed2k\":{\"state\":\"", $ed2k_state, "\",\"lowid\":", ($lowid ? "true" : "false");
	echo ",\"server\":\"", jesc($s["serv_name"]), "\"";
	echo ",\"addr\":\"", jesc($s["serv_addr"]), "\"";
	echo ",\"users\":", ($s["serv_users"] + 0), "}";
	echo ",\"kad\":{\"connected\":", ($s["kad_connected"] == 1) ? "true" : "false";
	echo ",\"firewalled\":", ($s["kad_firewalled"] == 1) ? "true" : "false", "}";
	echo ",\"categories\":[";
	$cats = amule_get_categories();
	$i = 0;
	foreach ($cats as $c) { if ($i != 0) { echo ","; } echo "\"", jesc($c), "\""; $i = 1; }
	echo "]}";

//
// ---- transfers (downloads + uploads) -------------------------------
//
} elseif ($r == "transfers") {
	$downloads = amule_load_vars("downloads");
	$uploads = amule_load_vars("uploads");
	echo "{\"downloads\":[";
	$i = 0;
	foreach ($downloads as $f) {
		if ($i != 0) { echo ","; }
		echo "{\"hash\":\"", $f->hash, "\"";
		echo ",\"name\":\"", jesc($f->name), "\"";
		echo ",\"size\":", ($f->size + 0);
		echo ",\"size_done\":", ($f->size_done + 0);
		echo ",\"size_xfer\":", ($f->size_xfer + 0);
		echo ",\"speed\":", ($f->speed + 0);
		echo ",\"src_count\":", ($f->src_count + 0);
		echo ",\"src_count_xfer\":", ($f->src_count_xfer + 0);
		echo ",\"src_count_not_curr\":", ($f->src_count_not_curr + 0);
		echo ",\"src_count_a4af\":", ($f->src_count_a4af + 0);
		echo ",\"status\":", ($f->status + 0);
		echo ",\"prio\":", ($f->prio + 0);
		echo ",\"prio_auto\":", ($f->prio_auto + 0);
		echo ",\"category\":", ($f->category + 0), "}";
		$i = 1;
	}
	echo "],\"uploads\":[";
	$i = 0;
	foreach ($uploads as $f) {
		if ($i != 0) { echo ","; }
		echo "{\"name\":\"", jesc($f->name), "\"";
		echo ",\"user_name\":\"", jesc($f->user_name), "\"";
		echo ",\"xfer_up\":", ($f->xfer_up + 0);
		echo ",\"xfer_down\":", ($f->xfer_down + 0);
		echo ",\"xfer_speed\":", ($f->xfer_speed + 0), "}";
		$i = 1;
	}
	echo "]}";

//
// ---- shared files --------------------------------------------------
//
} elseif ($r == "shared") {
	$shared = amule_load_vars("shared");
	echo "{\"shared\":[";
	$i = 0;
	foreach ($shared as $f) {
		if ($i != 0) { echo ","; }
		echo "{\"hash\":\"", $f->hash, "\"";
		echo ",\"name\":\"", jesc($f->name), "\"";
		echo ",\"size\":", ($f->size + 0);
		echo ",\"xfer\":", ($f->xfer + 0);
		echo ",\"xfer_all\":", ($f->xfer_all + 0);
		echo ",\"req\":", ($f->req + 0);
		echo ",\"req_all\":", ($f->req_all + 0);
		echo ",\"accept\":", ($f->accept + 0);
		echo ",\"accept_all\":", ($f->accept_all + 0);
		echo ",\"prio\":", ($f->prio + 0);
		echo ",\"prio_auto\":", ($f->prio_auto + 0), "}";
		$i = 1;
	}
	echo "]}";

//
// ---- servers -------------------------------------------------------
//
} elseif ($r == "servers") {
	$servers = amule_load_vars("servers");
	echo "{\"servers\":[";
	$i = 0;
	foreach ($servers as $f) {
		if ($i != 0) { echo ","; }
		echo "{\"name\":\"", jesc($f->name), "\"";
		echo ",\"desc\":\"", jesc($f->desc), "\"";
		echo ",\"addr\":\"", jesc($f->addr), "\"";
		echo ",\"ip\":", ($f->ip + 0);
		echo ",\"port\":", ($f->port + 0);
		echo ",\"users\":", ($f->users + 0);
		echo ",\"maxusers\":", ($f->maxusers + 0);
		echo ",\"files\":", ($f->files + 0), "}";
		$i = 1;
	}
	echo "]}";

//
// ---- search results ------------------------------------------------
//
} elseif ($r == "search") {
	$results = amule_load_vars("searchresult");
	echo "{\"results\":[";
	$i = 0;
	foreach ($results as $f) {
		if ($i != 0) { echo ","; }
		echo "{\"hash\":\"", $f->hash, "\"";
		echo ",\"name\":\"", jesc($f->name), "\"";
		echo ",\"size\":", ($f->size + 0);
		echo ",\"sources\":", ($f->sources + 0);
		echo ",\"present\":", ($f->present == 1) ? "true" : "false", "}";
		$i = 1;
	}
	echo "]}";

//
// ---- options -------------------------------------------------------
//
} elseif ($r == "options") {
	$opts = amule_get_options();
	echo "{\"nick\":\"", jesc($opts["nick"]), "\"";
	$groups = array("connection", "files", "webserver");
	foreach ($groups as $g) {
		$co = $opts[$g];
		foreach ($co as $k => $v) {
			echo ",\"", jesc($k), "\":\"", jesc($v), "\"";
		}
	}
	echo ",\"categories\":[";
	$cats = amule_get_categories();
	$i = 0;
	foreach ($cats as $c) { if ($i != 0) { echo ","; } echo "\"", jesc($c), "\""; $i = 1; }
	echo "]}";

//
// ---- log / serverinfo (PLAIN TEXT, not JSON) -----------------------
// The log is large, multi-line and can embed non-ASCII file names; passing
// it through jesc() would destroy it (see note in jesc). The client reads
// these two routes with res.text().
//
} elseif ($r == "log") {
	$rst = $HTTP_GET_VARS["reset"] + 0;
	echo amule_get_log($rst);

} elseif ($r == "serverinfo") {
	$rst = $HTTP_GET_VARS["reset"] + 0;
	echo amule_get_serverinfo($rst);

//
// ---- statistics: server-rendered graphs + tree ---------------------
// statsgraph registers the dynamic PNGs (amule_stats_download.png,
// amule_stats_upload.png, amule_stats_conncount.png, amule_stats_kad.png)
// for this session; the client then loads them directly like the stock
// template does.
//
} elseif ($r == "statsgraph") {
	amule_load_vars("stats_graph");
	echo "{\"ok\":true}";

// Nested tree as JSON. The interpreter cannot recurse, so the depth is
// unrolled by hand; the real tree is ~4 levels deep, 6 are covered.
} elseif ($r == "statstree") {
	$t1 = amule_load_vars("stats_tree");
	echo "{";
	$i1 = 0;
	foreach ($t1 as $k1 => $v1) {
		if ($i1 != 0) { echo ","; }
		echo "\"", jesc($k1), "\":";
		if (count(&$v1)) {
			echo "{";
			$i2 = 0;
			foreach ($v1 as $k2 => $v2) {
				if ($i2 != 0) { echo ","; }
				echo "\"", jesc($k2), "\":";
				if (count(&$v2)) {
					echo "{";
					$i3 = 0;
					foreach ($v2 as $k3 => $v3) {
						if ($i3 != 0) { echo ","; }
						echo "\"", jesc($k3), "\":";
						if (count(&$v3)) {
							echo "{";
							$i4 = 0;
							foreach ($v3 as $k4 => $v4) {
								if ($i4 != 0) { echo ","; }
								echo "\"", jesc($k4), "\":";
								if (count(&$v4)) {
									echo "{";
									$i5 = 0;
									foreach ($v4 as $k5 => $v5) {
										if ($i5 != 0) { echo ","; }
										echo "\"", jesc($k5), "\":";
										if (count(&$v5)) {
											echo "{";
											$i6 = 0;
											foreach ($v5 as $k6 => $v6) {
												if ($i6 != 0) { echo ","; }
												echo "\"", jesc($k6), "\":null";
												$i6 = 1;
											}
											echo "}";
										} else { echo "null"; }
										$i5 = 1;
									}
									echo "}";
								} else { echo "null"; }
								$i4 = 1;
							}
							echo "}";
						} else { echo "null"; }
						$i3 = 1;
					}
					echo "}";
				} else { echo "null"; }
				$i2 = 1;
			}
			echo "}";
		} else { echo "null"; }
		$i1 = 1;
	}
	echo "}";

// ====================================================================
// State-changing actions (POST). Gated on guest mode.
// ====================================================================

} elseif ($guest != 0) {
	echo "{\"ok\":false,\"error\":\"guest\"}";

} elseif ($r == "dload_cmd") {
	$cmd = $HTTP_GET_VARS["cmd"];
	$hh = 0; $hh = split(",", $HTTP_GET_VARS["hashes"]);
	foreach ($hh as $h) { if (strlen($h) == 32) { amule_do_download_cmd($h, $cmd); } }
	echo "{\"ok\":true}";

} elseif ($r == "shared_cmd") {
	$cmd = $HTTP_GET_VARS["cmd"];
	if ($cmd == "reload") {
		amule_do_reload_shared_cmd();
	} else {
		$prio = $HTTP_GET_VARS["prio"] + 0;
		$hh = 0; $hh = split(",", $HTTP_GET_VARS["hashes"]);
		foreach ($hh as $h) { if (strlen($h) == 32) { amule_do_shared_cmd($h, $cmd, $prio); } }
	}
	echo "{\"ok\":true}";

} elseif ($r == "ed2k") {
	// The category MUST be passed as a string: php_native_ed2k_download_cmd
	// rejects any non-string __param_1 ("Invalid or missing argument 2")
	// and silently sends nothing. It casts to a number itself.
	$cat = "" . $HTTP_GET_VARS["cat"];
	$link = $HTTP_GET_VARS["link"];
	if (strlen($link) > 0) {
		$parts = 0; $parts = split("ed2k://", $link);
		foreach ($parts as $part) { if (strlen($part) > 0) { amule_do_ed2k_download_cmd("ed2k://" . $part, $cat); } }
	}
	echo "{\"ok\":true}";

} elseif ($r == "search_start") {
	$type = $HTTP_GET_VARS["type"] + 0;
	$avail = $HTTP_GET_VARS["avail"] + 0;
	$min = $HTTP_GET_VARS["minsize"] + 0;
	$max = $HTTP_GET_VARS["maxsize"] + 0;
	amule_do_search_start_cmd($HTTP_GET_VARS["keyword"], "", "", $type, $avail, $min, $max);
	echo "{\"ok\":true}";

} elseif ($r == "search_download") {
	// Same string-type requirement as the ed2k route (see above).
	$cat = "" . $HTTP_GET_VARS["cat"];
	$hh = 0; $hh = split(",", $HTTP_GET_VARS["hashes"]);
	foreach ($hh as $h) { if (strlen($h) == 32) { amule_do_search_download_cmd($h, $cat); } }
	echo "{\"ok\":true}";

} elseif ($r == "server_cmd") {
	amule_do_server_cmd($HTTP_GET_VARS["ip"], $HTTP_GET_VARS["port"], $HTTP_GET_VARS["cmd"]);
	echo "{\"ok\":true}";

} elseif ($r == "server_add") {
	amule_do_add_server_cmd($HTTP_GET_VARS["addr"], $HTTP_GET_VARS["port"], $HTTP_GET_VARS["name"]);
	echo "{\"ok\":true}";

} elseif ($r == "server_disconnect") {
	amule_server_disconnect();
	echo "{\"ok\":true}";

} elseif ($r == "kad") {
	$action = $HTTP_GET_VARS["action"];
	if ($action == "connect_known") {
		amule_kad_start();
	} elseif ($action == "disconnect") {
		amule_kad_disconnect();
	} elseif ($action == "update_url") {
		$url = $HTTP_GET_VARS["url"];
		if (strlen($url) > 0) { amule_kad_update_from_url($url); }
	} elseif ($action == "connect_ip") {
		$ip0 = $HTTP_GET_VARS["ip0"] + 0;
		$ip1 = $HTTP_GET_VARS["ip1"] + 0;
		$ip2 = $HTTP_GET_VARS["ip2"] + 0;
		$ip3 = $HTTP_GET_VARS["ip3"] + 0;
		$port = $HTTP_GET_VARS["port"] + 0;
		$packed = $ip0 * 16777216 + $ip1 * 65536 + $ip2 * 256 + $ip3;
		if ($packed != 0 and $port != 0) { amule_kad_connect($packed, $port); }
	}
	echo "{\"ok\":true}";

} elseif ($r == "set_options") {
	$conn_opts = array("max_line_up_cap", "max_up_limit", "max_line_down_cap",
		"max_down_limit", "slot_alloc", "tcp_port", "udp_port", "udp_dis",
		"max_file_src", "max_conn_total", "autoconn_en", "reconn_en",
		"network_ed2k", "network_kad");
	$file_opts = array("check_free_space", "extract_metadata", "ich_en",
		"aich_trust", "preview_prio", "save_sources", "resume_same_cat",
		"min_free_space", "new_files_paused", "alloc_full", "alloc_full_chunks",
		"new_files_auto_dl_prio", "new_files_auto_ul_prio");
	$web_opts = array("use_gzip", "autorefresh_time");
	$all_opts;
	foreach ($conn_opts as $k) {
		$v = $HTTP_GET_VARS[$k];
		if ($v == "on") { $v = 1; }
		if ($v == "") { $v = 0; }
		$all_opts["connection"][$k] = $v;
	}
	foreach ($file_opts as $k) {
		$v = $HTTP_GET_VARS[$k];
		if ($v == "on") { $v = 1; }
		if ($v == "") { $v = 0; }
		$all_opts["files"][$k] = $v;
	}
	foreach ($web_opts as $k) {
		$v = $HTTP_GET_VARS[$k];
		if ($v == "on") { $v = 1; }
		if ($v == "") { $v = 0; }
		$all_opts["webserver"][$k] = $v;
	}
	$nick = $HTTP_GET_VARS["nick"];
	if ($nick != "") { $all_opts["nick"] = $nick; }
	amule_set_options($all_opts);
	echo "{\"ok\":true}";

} else {
	echo "{\"ok\":false,\"error\":\"unknown route\"}";
}
?>
