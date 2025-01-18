<?php

error_reporting(E_ALL);
ini_set('display_errors', TRUE);
ini_set('display_startup_errors', TRUE);

include_once __DIR__ . '/../config/config.inc.php';

$ntbb_groups = array(
	array(
		'name' => 'Guest',
		'symbol' => '',
	),
	array(
		'name' => '',
		'symbol' => '',
	),
	array(
		'name' => 'Administrator',
		'symbol' => '~',
	),
	array(
		'name' => 'Voice',
		'symbol' => '+',
	),
	array(
		'name' => 'Driver',
		'symbol' => '%',
	),
	array(
		'name' => 'Moderator',
		'symbol' => '@',
	),
	array(
		'name' => 'Leader',
		'symbol' => '&',
	),
);
$STANDINGS = $psconfig['standings'];

include '../lib/ntbb-session.lib.php';
include '../lib/ntbb-ladder.lib.php';
include 'lib/panels.lib.php';

$authLevel = 0;
$auth2FA = substr($curuser['email'] ?? '', -1) === '@';
if ($curuser['group'] == 4) $authLevel = 2; // driver
if ($curuser['group'] == 5) $authLevel = 3; // mod
if ($curuser['group'] == 6) $authLevel = 4; // leader
if ($curuser['group'] == 6 && $auth2FA) $authLevel = 5; // leader with 2FA
if ($curuser['group'] == 2 && $auth2FA) $authLevel = 6; // admin
if ($authLevel === 6 && $auth2FA && ($curuser['userid'] === 'chaos' || $curuser['userid'] === 'zarel')) $authLevel = 10;

$userid = false;
$user = false;
$formats = array(
	'gen9randombattle' => 'Random Battle',
	'gen9ou' => 'OverUsed',
	'gen9ubers' => 'Ubers',
	'gen9uu' => 'UnderUsed',
	'gen9ru' => 'RarelyUsed',
	'gen9nu' => 'NeverUsed',
	'gen9pu' => 'PU',
	'gen9lc' => 'Little Cup',
	'gen9monotype' => 'Monotype',
	'gen9bssregh' => 'Battle Stadium Singles Regulation H',
	'gen9cap' => 'CAP',
	'gen9randomdoublesbattle' => 'Random Doubles Battle',
	'gen9doublesou' => 'Doubles OU',
	'gen9vgc2024regh' => 'VGC 2024 Regulation H',
	'gen9almostanyability' => 'Almost Any Ability',
	'gen9balancedhackmons' => 'Balanced Hackmons',
	'gen9godlygift' => 'Godly Gift',
	'gen9inheritance' => 'Inheritance',
	'gen9mixandmega' => 'Mix and Mega',
	'gen9partnersincrime' => 'Partners in Crime',
	'gen9sharedpower' => 'Shared Power',
	'gen9stabmons' => 'STABmons',
	'gen9nationaldex' => 'National Dex OU',
	'gen9nationaldexubers' => 'National Dex Ubers',
	'gen9nationaldexuu' => 'National Dex UU',
	'gen9nationaldexmonotype' => 'National Dex Monotype',
	'gen9nationaldexdoubles' => 'National Dex Doubles',
	'gen8randombattle' => '[Gen 8] Random Battle',
	'gen8ou' => '[Gen 8] OU',
	'gen7randombattle' => '[Gen 7] Random Battle',
	'gen7ou' => '[Gen 7] OU',
	'gen6randombattle' => '[Gen 6] Random Battle',
	'gen6ou' => '[Gen 6] OU',
	'gen5randombattle' => '[Gen 5] Random Battle',
	'gen5ou' => '[Gen 5] OU',
	'gen4ou' => '[Gen 4] OU',
	'gen3ou' => '[Gen 3] OU',
	'gen2ou' => '[Gen 2] OU',
	'gen1ou' => '[Gen 1] OU',
);

if (isset($_REQUEST['user']) && strlen($_REQUEST['user'])) {
	$userid = $users->userid($_REQUEST['user']);
	// 0 is falsy
	// I'm hardcoding here to fix a crash, but the rest of the system
	// should continue to reject 0 as a valid userid
	if ($_REQUEST['user'] === '0') $userid = '0';

	if (!strlen($userid)) {
		header('HTTP/1.1 404 Not Found');
		die("Invalid userid");
	}

	$user = $users->getUser($userid);

	if (substr($_SERVER['REQUEST_URI'], 0, 13) === '/users/?user=') {
		// really wish this could be done with mod_rewrite
		header('Location: https://' . $psconfig['routes']['users'] . '/'.$userid);
		die();
	}

	if (!$user || $user['banstate'] == 100) {
		if ($panels->output !== 'html') header('HTTP/1.1 404 Not Found');
		if (!$user) {
			$user = [
				'username' => $userid,
				'userid' => $userid,
				'group' => 0,
			];
		}
	}
}

if ($authLevel >= 3) {
	//file_put_contents(__DIR__ . '/../config/altaccesslog.txt', "{$curuser['username']} - $userid\n", FILE_APPEND);
}

if (isset($_REQUEST['json'])) {
	header('Content-Type: application/json');
	header('Access-Control-Allow-Origin: *');
	if (!$user) die('null');
	$ladder = new NTBBLadder('');
	$ladder->getAllRatings($user);
	$ratings = [];
	foreach ($user['ratings'] as $rating) {
		$ratings[$rating['formatid']] = [
			'elo' => $rating['elo'],
			'gxe' => $rating['gxe'],
			'rpr' => $rating['rpr'],
			'rprd' => $rating['rprd'],
		];
	}
	echo json_encode([
		'username' => $user['username'],
		'userid' => $user['userid'],
		'registertime' => intval(@$user['registertime']/(60*60*24))*60*60*24,
		'group' => intval($user['group'] ?? 0),
		'ratings' => $ratings,
	], JSON_FORCE_OBJECT);
	die();
}

if (!$user) {
	$panels->setPageTitle('Users');
	$panels->setPageDescription('Pokémon Showdown users');
} else {
	$panels->setPageTitle(''.$user['username'].' - Users');
	$panels->setPageDescription(''.$user['username'].'\'s user profile');
}
$panels->setTab('ladder');
$panels->start();

if (!$user) {
?>
	<div class="pfx-panel"><div class="pfx-body ladderlist">
		<h1>
			Find a user
		</h1>
		<form action="/users/" data-target="push">
			<input class="textbox" type="text" name="user" placeholder="Username" autofocus />
			<button class="button" type="submit">Go</button>
		</form>
	</div></div>
<?php
} else {
?>
	<div class="pfx-panel"><div class="pfx-body ladder">
		<a href="/ladder/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Ladder</a>
		<h1><?php echo htmlspecialchars($user['username']); ?></h1>

<?php

	// User management

	if ($authLevel >= 4 && substr($user['email'] ?? '', -1) === '@') echo '[2FA]';

	$canChangeGroup = $user['group'] == 2 ? $authLevel >= 10 : $authLevel >= 3;

	if ($user['group'] && $canChangeGroup) {
		$csrfOk = (!!$users->csrfCheck() && $authLevel >= 4);
		if ($csrfOk && isset($_POST['group'])) {
			$group = intval($_POST['group']);
			if ($group != 3 && $group != 4 && $group != 5 && $group != 6 && $group != 1) {
				die(" Cannot change to group $group - access denied.</div></div>");
			}
			$psdb->query("UPDATE ntbb_users SET `group` = ".intval($group)." WHERE userid = '".$psdb->escape($user['userid'])."' LIMIT 1");
			$user['group'] = $group;

			$modlogentry = "Group changed to $group ({$ntbb_groups[$group]['name']})";
			$psdb->query(
				"INSERT INTO `{$psdb->prefix}usermodlog` (`userid`,`actorid`,`date`,`ip`,`entry`) VALUES (?, ?, ?, ?, ?)",
				[$user['userid'], $curuser['userid'], time(), $users->getIp(), $modlogentry]
			);
?>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; margin-bottom: 1em">
			<p>Group updated</p>
		</div>
<?php
		} else if ($csrfOk && isset($_POST['standing'])) {
			$newStanding = intval($_POST['standing']);
			$psdb->query(
				"UPDATE {$psdb->prefix}users SET banstate = ? WHERE userid = ? LIMIT 1",
				[$newStanding, $user['userid']]
			);
			if ($newStanding === 30 || $newStanding === 100) {
				$psdb->query(
					"UPDATE ntbb_ladder SET elo = -abs(elo) WHERE userid = ?;",
					[$user['userid']]
				);
			} else {
				$psdb->query(
					"UPDATE ntbb_ladder SET elo = abs(elo) WHERE userid = ?;",
					[$user['userid']]
				);
			}

			$modlogentry = "Standing changed to $newStanding ({$STANDINGS[$newStanding]}): {$_POST['reason']}";
			$psdb->query(
				"INSERT INTO `{$psdb->prefix}usermodlog` (`userid`,`actorid`,`date`,`ip`,`entry`) VALUES (?, ?, ?, ?, ?)",
				[$user['userid'], $curuser['userid'], time(), $users->getIp(), $modlogentry]
			);

			$user['banstate'] = @$_POST['standing'];
			$count = $psdb->query("SELECT COUNT(*) FROM ntbb_users WHERE ip = '".$psdb->escape($user['ip'])."' LIMIT 1");
			$count = $psdb->fetch_assoc($count);
			$count = $count['COUNT(*)'];
?>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; margin-bottom: 1em">
			<p>Standing updated</p>
			<?php if ($count > 1) echo '<p><a href="/usersearch/?ip='.$user['ip'].'" data-target="push">(Consider updating standing for '.$count.' alts)</a></p>' ?>
		</div>
<?php
		} else if ($csrfOk && isset($_POST['moveladder'])) {
			$newName = $_POST['moveladder'];
			$newUserid = $users->userid($newName);
			if (!$newUserid || $newUserid === $user['userid']) die("invalid username");
			$psdb->query(
				"UPDATE {$psdb->prefix}ladder SET userid = ? WHERE userid = ?",
				['_'.$user['userid'], $newUserid]
			);
			$psdb->query(
				"UPDATE {$psdb->prefix}ladder SET userid = ?, username = ?, elo = abs(elo) WHERE userid = ?",
				[$newUserid, $newName, $user['userid']]
			);
			$psdb->query(
				"UPDATE {$psdb->prefix}ladder SET userid = ?, username = ?, elo = abs(elo) WHERE userid = ?",
				[$user['userid'], $user['username'], '_'.$user['userid']]
			);

			$modlogentry = "Ladder swapped with " . $user['userid'];
			$psdb->query(
				"INSERT INTO `{$psdb->prefix}usermodlog` (`userid`,`actorid`,`date`,`ip`,`entry`) VALUES (?, ?, ?, ?, ?)",
				[$newUserid, $curuser['userid'], time(), $users->getIp(), $modlogentry]
			);
			$modlogentry = "Ladder swapped with " . $newUserid;
			$psdb->query(
				"INSERT INTO `{$psdb->prefix}usermodlog` (`userid`,`actorid`,`date`,`ip`,`entry`) VALUES (?, ?, ?, ?, ?)",
				[$user['userid'], $curuser['userid'], time(), $users->getIp(), $modlogentry]
			);
?>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; margin-bottom: 1em">
			<p>Ladder record swapped</p>
		</div>
<?php
		} else if ($csrfOk && isset($_POST['googlelogin'])) {
			$email = $_POST['googlelogin'];
			$remove = ($email === 'remove');
			if (!$remove && (strpos($email, '@') === false || strpos($email, '.') === false)) {
?>
				<div style="border: 1px solid #AADD88; padding: 0 1em; margin-bottom: 1em">
					<p>Invalid e-mail address "<?= htmlspecialchars($email) ?>"</p>
				</div>
<?php
			} else {
				$psdb->query(
					"UPDATE {$psdb->prefix}users SET email = ? WHERE userid = ?",
					[$remove ? '' : $email . '@', $user['userid']]
				);

				$modlogentry = $remove ? "Login method set to password" : "Login method set to Google " . $email;
				$psdb->query(
					"INSERT INTO `{$psdb->prefix}usermodlog` (`userid`,`actorid`,`date`,`ip`,`entry`) VALUES (?, ?, ?, ?, ?)",
					[$user['userid'], $curuser['userid'], time(), $users->getIp(), $modlogentry]
				);
?>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; margin-bottom: 1em">
			<p>Login method updated</p>
		</div>
<?php
			}
		} else if ($csrfOk && $authLevel >= 6 && @$_POST['passreset']) {
			$token = $users->createPasswordResetToken($user['userid']);
?>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; margin-bottom: 1em">
			<p>
				Use this link:
			</p>
			<p>
				<textarea class="textbox" style="width:100%;box-sizing:border-box" readonly>https://<?= $psconfig['routes']['root'] ?>/resetpassword/<?= $token ?></textarea><br />
				<button name="copyUrl">Copy URL</button>
			</p>
		</div>
<?php
		}
?>
		<button onclick="$('.usermanagement').show();$(this).hide();return false">User management</button>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; display:none" class="usermanagement">
			<form action="" method="post" data-target="replace"><p>
				<?php $users->csrfData(); ?>
				<label class="label"><strong>Group:</strong><br />
				<select name="group" class="textbox"<?php if (!$canChangeGroup) echo ' disabled'; ?>>
<?php
		foreach ($ntbb_groups as $i => $group) {
			if (!$i) continue;
?>
					<option value="<?php echo $i ?>"<?php if ($user['group'] == $i) echo ' selected="selected"'; ?>><?php echo $group['name']; ?></option>
<?php
		}
?>
				</select></label><?php if ($canChangeGroup) { ?> <button type="submit"><strong>Change</strong></button><?php } ?>
			</p></form>
			<p>
				<strong class="label"><label>IP: </label></strong><br />
				<?php echo $user['ip'] ?> (<a href="/usersearch/?ip=<?php echo $user['ip'] ?>" data-target="push">Alts</a> | <a href="https://whatismyipaddress.com/ip/<?php echo $user['ip'] ?>" target="_blank">GeoIP</a>)
			</p>
			<?php
				if ($user['outdatedpassword']) echo '<p>&#x2713; Abandoned account</p>';
			?>
			<form action="" method="post" data-target="replace"><p>
				<?php $users->csrfData(); ?>
				<strong class="label"><label>Standing: </label></strong><br />
<select name="standing" class="textbox"<?php if ($authLevel < 4) echo ' disabled'; ?>><?php
		$userstanding = intval($user['banstate']);
		// standings:
		$userstandingshown = false;
		foreach ($STANDINGS as $standing => $name) {
			if (!$userstandingshown && (!$name || $userstanding < $standing)) {
				echo '<option value="',$userstanding,'" selected>',$userstanding,'</option>';
				$userstandingshown = true;
			}
			if ($name) {
				echo '<option value="',$standing,'"',($userstanding==$standing?' selected':''),'>',$standing,' = ',$name,'</option>';
				if ($userstanding == $standing) $userstandingshown = true;
			}

		}
?></select><?php if ($authLevel >= 4) { ?> <input name="reason" type="text" class="textbox" size="46" placeholder="Reason" style="display:none" /> <button type="submit"><strong>Change</strong></button><?php } ?>
			</p></form>
<?php
		if ($authLevel >= 4) {
?>
			<form action="" method="post" data-target="replace"><p>
				<?php $users->csrfData(); ?>
				<strong>Swap ladder rating:</strong><br /> <input type="text" name="moveladder" placeholder="New username" value="" /> <button type="submit">Swap rating</button>
			</p></form>
			<form action="" method="post" data-target="replace"><p>
				<?php $users->csrfData(); ?>
				<strong>Login with Google account:</strong><br /> <input type="text" name="googlelogin" placeholder="Email" value="<?= substr($user['email'] ?? '', -1) === '@' ? substr($user['email'], 0, -1) : '' ?>" /> <button type="submit">Update login method</button> (<code>remove</code> to remove)
			</p></form>
<?php
		}
		if ($authLevel >= 6) {
?>
			<form action="" method="post" data-target="replace"><p>
				<?php $users->csrfData(); ?>
				<input type="hidden" name="passreset" value="1" />
				<strong>Password:</strong><br /> <button type="submit">Create password reset link</button>
			</p></form>
<?php
		}
?>
		</div>
<?php
	} else if (!$user['group'] && $users->isLeader()) {
		$csrfOk = false;
		if ($users->csrfCheck()) {
			$csrfOk = true;
		}
		if ($csrfOk && $_POST['standing'] ?? null) {
			$ctime = time();
			$newStanding = $_POST['standing'];
			$psdb->query(
				"INSERT INTO ntbb_users (`userid`,`username`,`passwordhash`,`email`,`registertime`,`ip`,`banstate`) VALUES (?,?,'','',?,'',?)",
				[$user['userid'], $user['userid'], $ctime, $newStanding]
			);
			$modlogentry = "Created dummy user with standing $newStanding ({$STANDINGS[$newStanding]})";
			$psdb->query(
				"INSERT INTO `{$psdb->prefix}usermodlog` (`userid`,`actorid`,`date`,`ip`,`entry`) VALUES (?, ?, ?, ?, ?)",
				[$user['userid'], $curuser['userid'], time(), $users->getIp(), $modlogentry]
			);
			$user['banstate'] = $_POST['standing'];
?>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; margin-bottom: 1em">
			<p>Dummy user created; Standing updated</p>
		</div>
<?php
		}
?>
		<button onclick="$('.usermanagement').show();$(this).hide();return false">User management</button>
		<div style="border: 1px solid #DDAA88; padding: 0 1em; display:none" class="usermanagement">
			<form action="" method="post" data-target="replace"><p>
				<?php $users->csrfData(); ?>
				<input type="hidden" name="standing" value="100" />
				<button type="submit"><strong>Disable</strong></button>
			</p></form>
		</div>
<?php
	}


	// Group

	if (@$user['banstate'] == 100 || @$user['outdatedpassword']) {
		$user['ratings'] = [];
?>
		<p>
			<small>(Account disabled)<?php
			if ($authLevel >= 2) echo ' <a href="/users/'.$userid.'/modlog" data-target="push">(Usermodlog)</a>';
?></small>
		</p>
<?php
	} else if (@$user['banstate'] == 20 || @$user['banstate'] == 30) {
?>
		<p>
			<small style="color: #CC2222">(Banned indefinitely)</small>
		</p>
		<p>
			<small><em>Joined:</em> <?php echo date("M j, Y", $user['registertime']); ?><?php
			if ($authLevel >= 2) echo ' <a href="/users/'.$userid.'/modlog" data-target="push">(Usermodlog)</a>';
?></small>
		</p>
<?php
	} else if ($user['group']) {
		$groupName = $users->getGroupName($user);
		$groupSymbol = $users->getGroupSymbol($user);
		if ($groupSymbol === '~' || $groupSymbol === '&') {
?>
		<p>
			<strong><?php echo $groupSymbol,' ',$groupName; ?></strong>
		</p>
<?php
		}
?>
		<p>
			<small><em>Joined:</em> <?php echo date("M j, Y", $user['registertime']); ?><?php
			if ($authLevel >= 2) echo ' <a href="/users/'.$userid.'/modlog" data-target="push">(Usermodlog)</a>';
?></small>
		</p>
<?php
	} else {
?>
		<p>
			<small>(Unregistered)</small>
		</p>
<?php
	}
	if ($user['userid'] === 'slarty' || $user['userid'] === 'peterthegreeat' || $user['userid'] === 'chrisloud' || $user['userid'] === 'skitty' || $user['userid'] === 'aulu' || $user['userid'] === 'morfent' || $user['userid'] === 'mikotomisaka' || $user['userid'] === 'xbossarux' || $user['userid'] === 'victoriousbig') {
		echo '<p>;_;7</p>';
	}

	// Ladder

	$ladderTourID = str_starts_with($user['userid'], 'lt11');
	if ($user['userid'] === $curuser['userid'] && !$ladderTourID) {
		if ($users->csrfCheck() && @$_POST['resetLadder']) {
			$formatLadder = new NTBBLadder(@$_POST['resetLadder']);
			if (substr($formatLadder->formatid, -7) !== 'current' && substr($formatLadder->formatid, -11) !== 'suspecttest') {
				$formatLadder->clearWL($curuser);
			}
		}
	}
	if ((@$user['banstate'] != 100 && @$user['banstate'] != 30) || $authLevel >= 4) {
		$ladder = new NTBBLadder('');
		$ladder->getAllRatings($user);
	}

	$bufs = ['official' => '', 'unofficial' => ''];
	if (@$user['ratings']) foreach (@$user['ratings'] as $row) {
		if ($row['w'] + $row['l'] + $row['t'] == 0 && $row['elo'] < 1050) continue;
		$buftype = isset($formats[$row['formatid']])?'official':'unofficial';
		$bufs[$buftype] .= '<tr><td>'.htmlspecialchars($row['formatid']).'</td><td style="text-align:center"><strong>'.round($row['elo']).'</strong></td>';
		if ($row['rprd'] < 100) {
			$bufs[$buftype] .= '<td style="text-align:center">'.number_format($row['gxe'],1).'<small>%</small></td><td style="text-align:center">'.'<em>'.round($row['rpr']).'<small> &#177; '.round($row['rprd']).'</small></em>';
		} else {
			$bufs[$buftype] .= '<td style="text-align:center" colspan="2"><small style="color:#777">(more games needed)</small>';
		}
		if ($user['userid'] === $curuser['userid'] && !$ladderTourID) {
			$bufs[$buftype] .= '</td><td style="text-align:center"><small>' . $row['w'] . '</small></td><td style="text-align:center"><small>' . $row['l'] . '</small></td>';
			if (substr($row['formatid'], -7) !== 'current' && substr($row['formatid'], -11) !== 'suspecttest') {
				$bufs[$buftype] .= '<td><button name="openReset" value="'.htmlspecialchars($row['formatid']).'"><small>Reset</small></button></td>';
			}
		}
		$bufs[$buftype] .= '</tr>';
	}

	if ($bufs['official'] || $bufs['unofficial']) {
?>
		<h2>Ratings</h2>
		<div><table>
<?php
		if ($bufs['official']) {
?>
			<tr>
				<th width="150">Official ladder</th>
				<th width="55" style="text-align:center"><abbr title="Elo rating">Elo</abbr></th>
				<th width="50" style="text-align:center"><abbr title="user's percentage chance of winning a random battle (aka GLIXARE)">GXE</abbr></th>
				<th width="80" style="text-align:center"><abbr title="Glicko-1 rating: rating&#177;deviation">Glicko-1</abbr></th>
				<th width="20" style="text-align:center"><abbr title="Wins">W</abbr></th>
				<th width="20" style="text-align:center"><abbr title="Losses">L</abbr></th>
			</tr>
<?php
			echo $bufs['official'];
		}
		if ($bufs['unofficial']) {
?>
			<tr>
				<th width="150">Unofficial ladder</th>
				<th width="55" style="text-align:center"><abbr title="Elo rating">Elo</abbr></th>
				<th width="50" style="text-align:center"><abbr title="user's percentage chance of winning a random battle (aka GLIXARE)">GXE</abbr></th>
				<th width="80" style="text-align:center"><abbr title="Glicko-1 rating: rating&#177;deviation">Glicko-1</abbr></th>
				<th width="20" style="text-align:center"><abbr title="Wins">W</abbr></th>
				<th width="20" style="text-align:center"><abbr title="Losses">L</abbr></th>
			</tr>
<?php
			echo $bufs['unofficial'];
		}
?>
<?php
		if ($user['userid'] === $curuser['userid'] && !$ladderTourID) {
?>
			<tr style="display:none" class="ladderresetform">
				<td colspan="7">
					<form action="" method="post" data-target="replace">
						<?php $users->csrfData(); ?><input type="hidden" name="resetLadder" value="" />
						<p style="margin: 5px 0"><span class="message"></span></p>
						<p style="margin: 5px 0"><button type="submit"><strong>Reset W/L</strong></button> <button name="cancelReset">Cancel</button></p>
					</form>
				</td>
			</tr>
<?php
		}
?>
		</table></div>
<?php
	}
?>

	</div></div>
<?php
}
$panels->end();
?>
