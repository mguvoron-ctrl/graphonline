<?php

    $admin = new AdminModel();

    // Если человек уже залогинен, то редиректим его с этой страницы
    if ($admin->IsAuth())
    {
        header("Location: " . SiteRoot($g_config['admin_sector']['after_login_page']));
        exit();
    }

    $msg = '';
    if (Post('is_login'))
    {
        $login = is_string($_POST['login'] ?? null) ? $_POST['login'] : '';
        $pwd = is_string($_POST['pwd'] ?? null) ? $_POST['pwd'] : '';
        $errs  = array();

        if (empty($login))
        {
            $errs[] = "Впишите логин";
        }
        if (empty($pwd))
        {
            $errs[] = "Впишите пароль";
        }

        if (!count($errs))
        {
            $isLogin = $admin->Login($login, $pwd);
            if ($isLogin)
            {
                header("Location: " . SiteRoot($g_config['admin_sector']['after_login_page']));
                exit();
            }
            else
            {
                $errs[] = "Неверный логин или пароль";
            }
        }

        $msg = MsgErr(implode('<br>', $errs));
    }
?>
