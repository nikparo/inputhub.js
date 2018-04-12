# inputhub.js
A javascript hub for registering input events, marking them as handled (fulfilled) and for filtering out ghost events.

### Ghost event cycle

``` js
const types = 'mousedown/mouseup/mousemove/pointerdown/pointerup/pointermove/touchstart/touchend/touchmove/click'.split('/');
types.forEach(type => document.addEventListener(type, event => console.log(event.type, event.target)));
```

#### Touch
pointerdown
touchstart
pointerup
touchend
mousemove
mousedown
mouseup
click

#### Mouse
pointermove
mousemove

pointerdown
mousedown
pointerup
mouseup
click

### Example: Automatically "fulfilling" ghost mouse events.

After the `touchend` of a "tap", mobile browsers emit `mousemove`, `mouseenter`, `mousedown`, `mouseup`, `click`, all in one go. If you bind the same handler to both `touchstart` and `mousedown`, with no further detection, then your handler will execut twice on touch devices.

In the example below, `hub.fulfillGhostMouse` is triggered during the capture phase of the event, i.e. when the event is on its way down from the document to the `event.target`. As ghost mouse events are thus already fulfilled, `hub.fulfill(event)` will return false and the event handler will short-circuit.

```js
import InputHub from 'inputhub';

const hub = new InputHub();

// Fulfill ghost mouse events during the capture phase, i.e. during the events way from the document down to the target. (before normal handlers)
hub.on('mousedown/mouseup', hub.fulfillGhost.bind(hub), {capture: true, passive: true});

hub.on('mousedown/touchstart', (event) => {
  if (!hub.fulfill(event)) {
    // Fulfilled events (e.g. our ghost events) will end up here.
    return;
  }
  if (event.type === 'mousedown') {
    console.log('This will only fire if a mouse was used.');
  }
  if (event.type === 'touchstart') {
    console.log('This will only fire on touch devices.');
  }
});
```
