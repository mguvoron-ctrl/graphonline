<?php
require_once __DIR__ . '/bootstrap.php';
requireMethod('GET');
$path = getXMLFileName(requestName());
if (!is_file($path)) apiError(404, 'Graph not found');
$compressed = file_get_contents($path);
$body = $compressed === false ? false : @gzuncompress($compressed, 2 * 1024 * 1024);
if ($body === false) apiError(422, 'Stored graph is invalid');
header('Content-Type: application/xml; charset=utf-8');
echo $body;
