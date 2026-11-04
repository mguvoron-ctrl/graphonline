<?php
/** Server-side admin sessions. Public deployment has no default password. */
class AdminModel
{
    private function startSession() {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('graphonline_admin');
            session_start(array('use_strict_mode' => 1, 'cookie_httponly' => true,
                'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
                'cookie_samesite' => 'Strict'));
        }
        if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    public function IsAuth() {
        $this->startSession();
        return !empty($_SESSION['admin']) && ($_SESSION['expires'] ?? 0) > time();
    }
    public function Token() { $this->startSession(); return $_SESSION['csrf']; }
    public function Login($login, $password) {
        $this->startSession();
        if (($_SESSION['retry_after'] ?? 0) > time()) return false;
        $hash = getenv('GRAPHONLINE_ADMIN_PASSWORD_HASH');
        $valid = $hash && hash_equals(getenv('GRAPHONLINE_ADMIN_LOGIN') ?: 'admin', $login) && password_verify($password, $hash);
        if ($valid) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true; $_SESSION['expires'] = time() + 3600;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            return true;
        }
        $_SESSION['retry_after'] = time() + 2;
        return false;
    }
    public function ChkLogin() {
        global $g_config;
        $this->startSession();
        if (!getenv('GRAPHONLINE_ADMIN_PASSWORD_HASH')) { http_response_code(503); exit('Admin access is disabled until configured.'); }
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && !hash_equals($this->Token(), (string)($_POST['csrf'] ?? ''))) {
            http_response_code(403); exit('Invalid request token');
        }
        $isLogin = SiteRoot(strtolower(GetQuery())) === SiteRoot($g_config['admin_sector']['after_logout_page']);
        if (!$this->IsAuth() && !$isLogin) { header('Location: ' . SiteRoot($g_config['admin_sector']['after_logout_page'])); exit; }
        // Legacy GET actions can modify files. Require POST even with an authenticated session.
        if ($this->IsAuth() && preg_match('~admin/(?:pack|logout|.*_add)$~', GetQuery()) && ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            http_response_code(405); exit('Use a CSRF-protected POST request');
        }
    }
    public function Logout() {
        $this->startSession(); $_SESSION = array(); session_destroy();
        setcookie(session_name(), '', array('expires' => 1, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict'));
    }
}
