<?php
/*
   Function to save/open graph
   */

// Only latic.
function isValidName($name)
{
	return is_string($name) && preg_match('/\A(?:autosave_)?[a-zA-Z]{1,64}(?:_test)?\z/D', $name) === 1;
}

function isAutoSave($name)
{
	return strpos($name, 'autosave_') === 0;
}

function getXMLFileName($graphName, $fromRoot=false)
{
    global $g_config;
    
    $auto_save = isAutoSave($graphName);

	$dirName = (rtrim(getenv("GRAPHONLINE_STORAGE_DIR") ?: dirname(__DIR__) . "/tmp/saved", "/") . "/") . ($auto_save ? 'autosave' : substr($graphName, 0, 2));

	return $dirName . "/$graphName.xml";
}


function getImageFileName($graphName, $fromRoot=false)
{
    global $g_config;
    
    $dirName = (rtrim(getenv("GRAPHONLINE_STORAGE_DIR") ?: dirname(__DIR__) . "/tmp/saved", "/") . "/") . substr($graphName, 0, 2);
return $dirName . "/$graphName.png";
}

function getSvgFileName($graphName, $fromRoot=false)
{
    global $g_config;
    
    $dirName = (rtrim(getenv("GRAPHONLINE_STORAGE_DIR") ?: dirname(__DIR__) . "/tmp/saved", "/") . "/") . substr($graphName, 0, 2);
return $dirName . "/$graphName.svg";
}

    
function saveGraphXML($graph, $name, $fromRoot = false)
{
    $res = false;
    if (isValidName($name))
    {
        $path = getXMLFileName($name, $fromRoot);
        if (!is_dir(dirname($path))) mkdir(dirname($path), 0755, true);
        $file = @fopen($path, "x");
        if ($file)
        {
            fprintf($file, "%s", gzcompress($graph, -1));
            fclose($file);
            $res = true;
        }
    }
    return $res;
}


?>