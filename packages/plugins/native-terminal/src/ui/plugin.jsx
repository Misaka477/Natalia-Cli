"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTerminalUiPlugin = createTerminalUiPlugin;
var solid_js_1 = require("solid-js");
var web_1 = require("solid-js/web");
var ui_host_1 = require("@natalia/ui-host");
var terminal_panel_1 = require("./terminal-panel");
function TerminalPanelHost(props) {
    var _a = (0, solid_js_1.createSignal)(props.ctx.projection.getState().sessionID), sessionID = _a[0], setSessionID = _a[1];
    var extra = props.ctx.extra;
    (0, solid_js_1.onMount)(function () {
        var update = function () {
            return setSessionID(props.ctx.projection.getState().sessionID);
        };
        var off = props.ctx.projection.subscribe(update);
        (0, solid_js_1.onCleanup)(off);
    });
    return (<terminal_panel_1.TerminalPane runtime={props.ctx.runtime} sessionID={sessionID()} runtimeURL={extra === null || extra === void 0 ? void 0 : extra.runtimeURL} token={extra === null || extra === void 0 ? void 0 : extra.token} active={true} events={props.ctx.events}/>);
}
function createTerminalUiPlugin() {
    return (0, ui_host_1.defineUiPlugin)({
        id: "natalia.ui.terminal",
        name: "Terminal UI",
        version: "1.0.0",
        description: "Interactive terminal panel.",
        panels: [
            {
                id: "terminal",
                title: "终端",
                region: "side",
                mount: function (ctx, container) {
                    container.replaceChildren();
                    var dispose = (0, web_1.render)(function () { return <TerminalPanelHost ctx={ctx}/>; }, container);
                    return function () { return dispose(); };
                },
            },
        ],
        mount: function () {
            return undefined;
        },
    });
}
