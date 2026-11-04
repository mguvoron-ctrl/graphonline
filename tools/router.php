<?php
// Development router matching the public application routes without exposing Git/config files.
$root = dirname(__DIR__);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (preg_match('~(?:^|/)\.|^/(?:core|model|src|tpl|tests|frontend|tools)(?:/|$)~', $path)) {
    http_response_code(404); exit;
}
$_SERVER['SERVER_NAME'] = 'localhost';
$file = realpath($root . $path);
if ($file && strpos($file, $root . '/') === 0 && is_file($file)) {
    if (pathinfo($file, PATHINFO_EXTENSION) === 'php') {
        if (!preg_match('~^/backend/(?:saveGraph|loadGraph|removeGraph|saveImage|saveSvg|vote)\.php$~', $path)) {
            http_response_code(403); exit;
        }
        chdir(dirname($file)); require $file; return true;
    }
    if (str_starts_with($path, '/tmp/saved/') && str_ends_with($path, '.svg')) {
        header('Content-Type: image/svg+xml');
        header('Content-Disposition: attachment');
        header("Content-Security-Policy: sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'");
        header('X-Content-Type-Options: nosniff');
        readfile($file); return true;
    }
    return false;
}
$_GET['q'] = ltrim($path, '/');
chdir($root);
require $root . '/index.php';
