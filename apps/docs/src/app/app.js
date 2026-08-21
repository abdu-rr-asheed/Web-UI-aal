import { __decorate } from "tslib";
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
let App = class App {
    title = signal('docs');
};
App = __decorate([
    Component({
        imports: [RouterOutlet],
        selector: 'aal-root',
        styleUrl: './app.scss',
        templateUrl: './app.html',
    })
], App);
export { App };
