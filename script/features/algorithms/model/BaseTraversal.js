/**
 * Find short path.
 *
 */
function BaseTraversal(graph, app)
{
    BaseAlgorithmEx.apply(this, arguments);
    this.visited = [];
    this.edges   = [];
    this.timer   = null;
}

// inheritance.
BaseTraversal.prototype = Object.create(BaseAlgorithmEx.prototype);
// timer interval
BaseTraversal.prototype.timerInterval = 500;

BaseTraversal.prototype.result = function(resultCallback)
{
    var result = {};
    result["version"] = 1;
    
    return result;
}

BaseTraversal.prototype.selectVertex = function(vertex) {
    if (this.timeline) this.timeline.pause();
    this.visited = [vertex]; this.edges = [];
    const index = new GraphOnline.GraphIndex(this.graph.vertices, this.graph.edges);
    this.traversalSteps = GraphOnline.traversalSteps(index, vertex, this.getId() === "OlegSh.DFSAlgorithm");
    this.message = this.getMainMessage() + this.controls();
    const steps = this.traversalSteps;
    this.timeline = new GraphOnline.Timeline(steps, (step, position) => {
        const prefix = steps.slice(0, position + 1);
        this.visited = prefix.map(visit => visit.vertex);
        this.edges = prefix.filter(visit => visit.edge).map(visit => visit.edge);
        this.app.redrawGraph(false);
        const state = document.getElementById("traversal-state");
        if (state) state.textContent = (position + 1) + "/" + steps.length + ": " + this.visited.map(v => v.mainText).join(" → ");
        const play = document.getElementById("traversal-play");
        if (play) play.textContent = GraphOnline.translate(this.timeline.playing ? "pause" : "play");
    });
    return true;
};
BaseTraversal.prototype.getMainMessage = function() {
    const start = this.visited[0];
    if (!start) return g_traversalOrder;
    let steps = this.traversalSteps;
    if (!steps || steps[0].vertex !== start) {
        steps = GraphOnline.traversalSteps(new GraphOnline.GraphIndex(this.graph.vertices, this.graph.edges), start, this.getId() === "OlegSh.DFSAlgorithm");
    }
    for (let i = 0; i < steps.length; i++) steps[i].vertex.upText = String(i + 1);
    return g_traversalOrder + steps.map(step => gEncodeToHTML(step.vertex.mainText)).join(" ") + " ";
};
BaseTraversal.prototype.controls = function() {
    return '<div class="d-flex flex-wrap gap-2 align-items-center" role="group" aria-label="Traversal controls">'
      + '<button type="button" class="btn btn-sm btn-outline-secondary" id="traversal-back">' + GraphOnline.translate("back") + '</button>'
      + '<button type="button" class="btn btn-sm btn-outline-secondary" id="traversal-play">' + GraphOnline.translate("play") + '</button>'
      + '<button type="button" class="btn btn-sm btn-outline-secondary" id="traversal-next">' + GraphOnline.translate("step") + '</button>'
      + '<label>× <select id="traversal-speed" aria-label="Playback speed"><option value="1000">0.5</option><option value="500" selected>1</option><option value="250">2</option><option value="100">5</option></select></label>'
      + '<output id="traversal-state" aria-live="polite"></output></div>';
};
BaseTraversal.prototype.messageWasChanged = function() {
    if (!this.timeline) return;
    const timeline = this.timeline;
    document.getElementById("traversal-back").onclick = () => timeline.back();
    document.getElementById("traversal-next").onclick = () => timeline.next();
    document.getElementById("traversal-play").onclick = () => {
        timeline.playing ? timeline.pause() : timeline.play(Number(document.getElementById("traversal-speed").value));
        timeline.refresh();
    };
    document.getElementById("traversal-speed").onchange = () => {
        if (timeline.playing) timeline.play(Number(document.getElementById("traversal-speed").value));
    };
    timeline.refresh();
};
BaseTraversal.prototype.cleanup = function() { if (this.timeline) this.timeline.pause(); };

BaseTraversal.prototype.getObjectSelectedGroup = function(object)
{
    return (this.visited.includes(object) ? 1 : (this.edges.includes(object) ? 1 : 0));
}

BaseTraversal.prototype.instance = function()
{
    return false;
}
