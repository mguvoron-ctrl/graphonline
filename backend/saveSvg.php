<?php
require_once __DIR__ . '/bootstrap.php';
requireMethod('POST');
$name = requestName();
$body = requestBody();
$xml = parseDocument($body, 'svg');
$allowed = array('svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','clipPath','linearGradient','radialGradient','stop','image','pattern','title','desc');
foreach ($xml->getElementsByTagName('*') as $element) {
    if (!in_array($element->localName, $allowed, true) || !in_array($element->namespaceURI, array(null, 'http://www.w3.org/2000/svg'), true)) apiError(422, 'Unsupported SVG element');
    foreach ($element->attributes as $attribute) {
        $value = trim($attribute->value);
        if (stripos($attribute->localName, 'on') === 0 || preg_match('/(?:javascript|vbscript|expression)\s*[:(]|@import/i', $value)) apiError(422, 'Unsafe SVG attribute');
        if (strtolower($attribute->localName) === 'href' && !preg_match('/^(?:#[a-zA-Z0-9_-]+|data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+\/=]+)$/D', $value)) apiError(422, 'External SVG resources are not allowed');
        if (stripos($value, 'url') !== false && !preg_match('/^url\(#[a-zA-Z0-9_-]+\)$/D', $value)) apiError(422, 'External SVG resources are not allowed');
    }
}
if ($xml->getElementsByTagName('script')->length || strpos($body, '<?xml-stylesheet') !== false) apiError(422, 'Unsafe SVG document');
publishFile(getSvgFileName($name), $xml->saveXML());
apiOK();
