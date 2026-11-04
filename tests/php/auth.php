<?php
require_once dirname(__DIR__, 2) . '/model/AdminModel.php';
putenv('GRAPHONLINE_ADMIN_PASSWORD_HASH=' . password_hash('regression-test-password', PASSWORD_DEFAULT));
putenv('GRAPHONLINE_ADMIN_LOGIN=regression-admin');
$auth = new AdminModel();
assert(!$auth->IsAuth());
assert(!$auth->Login('regression-admin', 'wrong-password'));
$_SESSION['retry_after'] = 0;
assert($auth->Login('regression-admin', 'regression-test-password'));
assert($auth->IsAuth());
assert(session_get_cookie_params()['httponly']);
assert(session_get_cookie_params()['samesite'] === 'Strict');
$_SESSION = array();
$_COOKIE['auto_admin_auth_login'] = 'regression-admin';
$_COOKIE['auto_admin_auth_pwd_hash'] = md5('regression-test-password');
assert(!$auth->IsAuth());
$auth->Logout();
echo "Admin session assertions passed\n";
