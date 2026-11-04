<?php
require_once __DIR__ . '/bootstrap.php';
requireMethod('POST');
$name = requestName();
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 3 * 1024 * 1024) apiError(413, 'Image too large');
$input = $_POST['base64data'] ?? '';
if (!is_string($input) || !preg_match('~^data:image/png;base64,([a-zA-Z0-9+/=]+)$~D', $input, $match)) apiError(422, 'Expected a PNG image');
$data = base64_decode($match[1], true);
$size = $data === false ? false : @getimagesizefromstring($data);
if (!$size || $size[2] !== IMAGETYPE_PNG || $size[0] > 4000 || $size[1] > 4000) apiError(422, 'Invalid PNG dimensions');
if (isset($_GET['x'])) {
    if (!function_exists('imagecreatefromstring')) apiError(503, 'Image processing unavailable; use browser export');
    foreach (array('x','y','width','height') as $key) {
        $value = filter_var($_GET[$key] ?? null, FILTER_VALIDATE_INT);
        if ($value === false || $value === null || $value < 0 || $value > 4000) apiError(422, 'Invalid crop rectangle');
    }
    $width = (int)$_GET['width']; $height = (int)$_GET['height'];
    if ($width < 1 || $height < 1) apiError(422, 'Invalid crop dimensions');
    $source = @imagecreatefromstring($data);
    if (!$source) apiError(422, 'Invalid PNG image');
    $target = imagecreatetruecolor($width, $height);
    imagesavealpha($target, true); imagealphablending($target, false);
    imagecopy($target, $source, 0, 0, (int)$_GET['x'], (int)$_GET['y'], $width, $height);
    ob_start(); imagepng($target); $data = ob_get_clean();
    imagedestroy($source); imagedestroy($target);
}
publishFile(getImageFileName($name), $data);
apiOK();
