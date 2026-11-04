<?php
require_once __DIR__ . '/bootstrap.php';
requireMethod('POST');
$name = requestName();
$body = requestBody();
validateGraph($body);
publishFile(getXMLFileName($name), gzcompress($body));
apiOK();
