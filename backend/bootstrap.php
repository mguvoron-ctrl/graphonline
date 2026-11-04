<?php
if (!defined('BASEPATH')) define('BASEPATH', dirname(__DIR__) . '/');
require_once BASEPATH . 'core/config/main.php';
require_once __DIR__ . '/saveGraphHelpers.php';
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function apiError($status, $message) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('error' => $message));
    exit;
}
function requireMethod($method) {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        apiError(405, 'Method not allowed');
    }
}
function requestName() {
    $name = $_GET['name'] ?? null;
    if (!isValidName($name)) apiError(400, 'Invalid document name');
    return $name;
}
function requestBody() {
    $limit = 2 * 1024 * 1024;
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) apiError(413, 'Document too large');
    $body = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($body === false) apiError(400, 'Unable to read request');
    if (strlen($body) > $limit) apiError(413, 'Document too large');
    return $body;
}
function parseDocument($body, $root) {
    if ($body === '' || stripos($body, '<!DOCTYPE') !== false || stripos($body, '<!ENTITY') !== false) apiError(422, 'Invalid XML document');
    $previous = libxml_use_internal_errors(true);
    $xml = new DOMDocument();
    $ok = $xml->loadXML($body, LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$ok || !$xml->documentElement || $xml->documentElement->localName !== $root) apiError(422, 'Invalid XML document');
    return $xml;
}
function validateGraph($body) {
    $xml = parseDocument($body, 'graphml');
    $xpath = new DOMXPath($xml);
    $graphs = $xpath->query('/*[local-name()="graphml"]/*[local-name()="graph"]');
    if ($graphs->length !== 1) apiError(422, 'Expected one graph');
    $nodes = $xpath->query('./*[local-name()="node"]', $graphs->item(0));
    $edges = $xpath->query('./*[local-name()="edge"]', $graphs->item(0));
    if ($nodes->length > 1000 || $edges->length > 10000) apiError(422, 'Graph exceeds limits');
    $ids = array();
    foreach ($nodes as $node) {
        $id = $node->getAttribute('id');
        if ($id === '' || isset($ids[$id])) apiError(422, 'Invalid vertex identifiers');
        $ids[$id] = true;
    }
    foreach ($edges as $edge) {
        if (!isset($ids[$edge->getAttribute('source')], $ids[$edge->getAttribute('target')])) apiError(422, 'Unknown edge endpoint');
    }
    return $xml;
}
// An atomic, immutable publication. Read-only links never confer write rights.
function publishFile($path, $data) {
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) apiError(503, 'Storage unavailable');
    if (is_file($path)) {
        if (hash_equals(hash_file('sha256', $path), hash('sha256', $data))) return;
        apiError(409, 'Snapshot already exists; publish with a new name');
    }
    $temporary = tempnam($directory, '.publish-');
    if ($temporary === false) apiError(503, 'Storage unavailable');
    $written = file_put_contents($temporary, $data, LOCK_EX);
    if ($written !== strlen($data)) { @unlink($temporary); apiError(503, 'Unable to save document'); }
    chmod($temporary, 0644);
    $published = @link($temporary, $path);
    @unlink($temporary);
    if (!$published) apiError(is_file($path) ? 409 : 503, 'Unable to publish snapshot');
}
function apiOK() {
    header('Content-Type: text/plain; charset=utf-8');
    echo 'OK';
}
