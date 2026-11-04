// Network boundary: callers only receive validated successful responses.
var DiskSaveLoad = function () {};
DiskSaveLoad.request = function(method, endpoint, name, data, callback) {
    return new Promise((resolve, reject) => {
        $.ajax({type: method, url: "/" + SiteDir + "backend/" + endpoint + "?name=" + encodeURIComponent(name),
            data: data, dataType: "text", contentType: "application/xml; charset=utf-8", timeout: 15000})
        .done(response => {
            if (method === "POST" && response.trim() !== "OK") {
                GraphOnline.status("saveError", true); reject(new Error("Invalid save response")); return;
            }
            try { if (callback) callback(response); resolve(response); }
            catch (error) { reject(error); }
        })
        .fail(() => { GraphOnline.status(method === "POST" ? "saveError" : "loadError", true); reject(new Error("Request failed")); });
    });
};
DiskSaveLoad.LoadGraphFromDisk = (name, callback) => DiskSaveLoad.request("GET", "loadGraph.php", name, undefined, callback);
DiskSaveLoad.SaveGraphOnDisk = (name, xml, callback) => DiskSaveLoad.request("POST", "saveGraph.php", name, xml, callback);
DiskSaveLoad.LoadAutoSaveGraphFromDisk = (name, callback) => DiskSaveLoad.LoadGraphFromDisk("autosave_" + name, callback);
