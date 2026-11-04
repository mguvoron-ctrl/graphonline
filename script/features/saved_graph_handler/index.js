doInclude ([
	include ("features/base_handler/index.js")
])

/**
 * Save dialog Graph handler.
 *
 */
function SavedDialogGraphHandler(app)
{
  BaseHandler.apply(this, arguments);
  this.message = "";
}

// inheritance.
SavedDialogGraphHandler.prototype = Object.create(BaseHandler.prototype);
// First selected.
SavedDialogGraphHandler.prototype.firstObject = null;
// Path
SavedDialogGraphHandler.prototype.pathObjects = null;
// Objects.
SavedDialogGraphHandler.prototype.objects    = null;

SavedDialogGraphHandler.prototype.showPublished = function(object)
{


	var dialogButtons = {};

	dialogButtons[g_close] = function() {
				$( this ).dialog( "close" );					
			};

	document.getElementById('GraphName').value = window.location.protocol + "//" + window.location.host + window.location.pathname +
							"?graph=" + this.app.GetGraphName();

 	document.getElementById('GraphName').select();

	var copyButton = document.getElementById('CopyGraphLink');
	if (copyButton) {
		copyButton.onclick = this.copyGraphLink.bind(this);
		this.setCopyButtonIcon('bi bi-copy');
	}

	$( "#saveDialog" ).dialog({
		resizable: false,
        height: "auto",
        width:  "auto",
		modal: true,
		title: g_save_dialog,
		buttons: dialogButtons,
		dialogClass: 'EdgeDialog'
	});
}

SavedDialogGraphHandler.prototype.copyGraphLink = function()
{
	var graphInput = document.getElementById('GraphName');
	if (!graphInput) {
		return;
	}

	var text = graphInput.value;
	if (!text) {
		return;
	}

	var self = this;
	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text).then(function() {
			self.setCopyButtonIcon('bi bi-check2-square');
		}, function() {
			self.fallbackCopyText(text);
		});
	} else {
		if (this.fallbackCopyText(text)) {
			this.setCopyButtonIcon('bi bi-check2-square');
		}
	}
};

SavedDialogGraphHandler.prototype.fallbackCopyText = function(text)
{
	var textarea = document.createElement('textarea');
	textarea.value = text;
	document.body.appendChild(textarea);
	textarea.select();

	var successful = false;
	try {
		successful = document.execCommand('copy');
	} catch (err) {
		successful = false;
	}
	document.body.removeChild(textarea);
	if (successful) {
		this.setCopyButtonIcon('bi bi-check2-square');
	}
	return successful;
};

SavedDialogGraphHandler.prototype.setCopyButtonIcon = function(iconClass)
{
	var icon = document.querySelector('#CopyGraphLink span');
	if (icon) {
		icon.className = iconClass;
	}
};

SavedDialogGraphHandler.prototype.show = function() { return this.app.SaveGraphOnDisk(() => this.showPublished()).catch(() => {}); };
