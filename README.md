# inputhub.js
A javascript hub for registering input events, marking them as handled (detained) and for getting rid of ghost mouse events on touch devices.

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
