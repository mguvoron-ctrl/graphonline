// Compatibility adapter around the typed history implementation.
function UndoStack(limit) { this.history = new GraphOnline.History(limit); }
UndoStack.prototype.PushToStack = function(action, data) { this.history.push(data); };
UndoStack.prototype.Undo = function(current) { return this.history.undo(current); };
UndoStack.prototype.Redo = function(current) { return this.history.redo(current); };
UndoStack.prototype.ClearUndoStack = function() { this.history.clear(); };
UndoStack.prototype.IsUndoStackEmpty = function() { return !this.history.canUndo; };
UndoStack.prototype.IsRedoStackEmpty = function() { return !this.history.canRedo; };
