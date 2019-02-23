# InputHub.js
A tiny javascript hub for recording input events, marking them as handled (fulfilled) and for filtering out ghost events.

## Motivation

Input event handling in javascript works well ... until `click`s are no longer enough, or you start nesting interactive elements within each other. All of a sudden you have multiple event handlers triggering, when you only wanted the "closest" one. Clicking an image in your fancy new gallery will select it ... until the click propagates through to the gallery window, where it is promptly deselected. Because clicking next to or between images should deselect them right?

Stack Overflow will recommend that you sprinkle your code with `event.stopPropagation()` (and probably `event.preventDefault()` for good measure), but this is an anti-pattern. `stopPropagation` is a Guillotine when all you want is an earmark. `stopPropagation` will completely stop the events, which means your analytics will not see the full picture, and your bootstrap dropdown menu will stay open since it listens to document clicks to know whether you still click around within it or not.

My motivation for creating InputHub was to simplify advanced event handling. The core idea is that the vast majority of input events only expect a single immediate result. This result is normally achieved by a single handler, the handler that is closest to the `event.target`. By earmarking the event as `fulfilled`, all later "main" handlers know that this event was not intended for them. Everything else is syntactic sugar and quality of life perks.


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

After the `touchend` of a "tap", mobile browsers emit `mousemove`, `mouseenter`, `mousedown`, `mouseup`, `click`, all in one go. If you bind the same handler to both `touchstart` and `mousedown`, with no further detection, then your handler will execute twice on touch devices.

There is a very similar issue on desktop browsers, if you want to use pointerevents. You get in fact: `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`. However, in this it is easy enough to bind to only one of `pointerdown` and `mousedown`, by checking pointer support. You can also simply use `hub.pointerdown`, which is a constant that resolves to either `pointerdown` or `mousedown/touchstart`.

In the example below, `hub.fulfillGhost()` is triggered during the capture phase of the event, i.e. when the event is on its way down from the document to the `event.target`. As the ghost events aren already fulfilled, `hub.fulfill(event)` will later return false and the event handler will short-circuit.

```js
import InputHub from 'inputhub';

const hub = new InputHub();

// Fulfill ghost mouse events during the capture phase, i.e. during the events way from the document down to the target. (before normal handlers)
hub.on('mousedown/mouseup', hub.fulfillGhost.bind(hub), { capture: true, passive: true });

// Record events that have not yet been seen by InputHub. Needed for e.g. fulfillGhost to work.
hub.on('mousedown/mouseup/touchstart/touchend', (event) => {
  if (!hub.isFulfilled(event)) {
    hub.register(event);
  }
}, { passive: true });

hub.on('mousedown/touchstart', (event) => {
  if (!hub.fulfill(event)) {
    // Fulfilled events (e.g. our ghost events) will end up here.
    return;
  }
  if (event.type === 'mousedown') {
    console.log('This will only fire if a mouse was used.');
    // Your mouse code here
  }
  if (event.type === 'touchstart') {
    console.log('This will only fire on touch devices.');
    // Your touch code here
  }
});
```
