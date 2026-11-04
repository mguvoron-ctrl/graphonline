
let DisableEmscripten = false;
let PostLoadedCalled  = false;

let editor = new Editor(document, window);

function resizeCanvas() {
  const canvas = document.getElementById('canvas');
  const width = document.getElementById('canvasSection').clientWidth;
  const height = window.innerHeight - canvas.getBoundingClientRect().top - 8;
  setDPIForCanvas(canvas, Math.max(1, width), Math.max(200, height));
  editor.redraw();
}

function touchHandler(event)
{
  var touches = event.changedTouches,
      first = touches[0],
      type = "";
  switch(event.type)
  {
      case "touchstart": type = "mousedown"; break;
      case "touchmove":  type="mousemove"; break;        
      case "touchend":   type="mouseup"; break;
      default: return;
  }

  var simulatedEvent = document.createEvent("MouseEvent");
  simulatedEvent.initMouseEvent(type, true, true, window, 1, 
                            first.screenX, first.screenY, 
                            first.clientX, first.clientY, false, 
                            false, false, false, 0/*left*/, null);

  first.target.dispatchEvent(simulatedEvent);
  event.preventDefault();
}
    
function handelImportGraph(files) {
    var graphFileToLoad = files[0];

    var fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent){
        var textFromFileLoaded = fileLoadedEvent.target.result;
        //console.log(textFromFileLoaded);
        try {
        editor.application.LoadNewGraphFromString(textFromFileLoaded);
        // Save graph to auto save after import.
        editor.application.saveAutoSave(textFromFileLoaded).catch(() => {});
        } catch (error) { GraphOnline.status("loadError", true); }
        ImportGraphFiles.value = "";
    };

    fileReader.readAsText(graphFileToLoad, "UTF-8");
}

function postLoadPage()
{
    if (!PostLoadedCalled) 
    {
        loadTexts();
        editor.init();
        PostLoadedCalled = true;
    }
}

$(document).ready(function ()
{
	window.onresize = function(event) 
    {
        resizeCanvas();
    }

    document.getElementById('canvas').addEventListener("touchstart", touchHandler, true);
    document.getElementById('canvas').addEventListener("touchmove", touchHandler, true);
    document.getElementById('canvas').addEventListener("touchend", touchHandler, true);
    document.getElementById('canvas').addEventListener("touchcancel", touchHandler, true);

    if (typeof WebAssembly !== "undefined" && typeof Worker !== "undefined" && !DisableEmscripten) {
        editor.application.algorithmRunner = new GraphOnline.AlgorithmRunner("/" + SiteDir + "script/dist/algorithm-worker.js?v=" + globalVersion);
    }

/*
	$(document).ready(function(){
	    //set up some basic options for the feedback_me plugin
	    fm_options = {
	        position: "left-bottom",
	        message_placeholder: g_what_do_you_think,
	        message_required: true,
	        name_label: g_name,
	        message_label: g_feedback,
	        trigger_label: g_feedback,
	        submit_label: g_send,
	        title_label: g_write_to_us,	        
	        feedback_url: "/feedback",
	    };
	    //init feedback_me plugin
	    fm.init(fm_options);
	});
*/
});

if ('serviceWorker' in navigator && window.isSecureContext && SiteDir === '') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(error => console.info('Offline cache unavailable', error)));
}
