'use strict';

import detectPassiveEvents from 'detect-passive-events';

const AWAIT_REACT = 'react';

export default class InputHub {
  constructor(options={}) {
    this.last = {};
    this.previous = {};

    // Store listeners in the form { 'type': WeakMap([{listener1: data}, {listener2: data}]) }
    // Using WeakMaps since we don't need to remember the listener if node.removeEventListener
    // was used to remove it directly.
    this.listeners = {};

    this.options = {
      typeSeparator: new RegExp(' |/'), // Split on ' ', '/'. Regex or string.
      domNode:       global.document,
      extendJQuery:  true,
      supportReact:  true,
      passiveTypes:  ['touchstart', 'touchmove', 'scroll'],
      ...options,
    };

    // Blaze (or jQuery?) creates new jQuery events for new templates, even for the same native event.
    // Checking event.fulfilled is therefore not dependable without extending jQuery.
    if (this.options.extendJQuery && (typeof jQuery !== 'undefined') && !jQuery.event.props.includes('fulfilled')) {
      jQuery.event.props.push('fulfilled');
    }
  }

  isFulfilled(event) {
    const ne = this.getNative(event);
    if (this.options.supportReact && ne.fulfilled === AWAIT_REACT && event.nativeEvent) {
      ne.fulfilled = false;
    }
    return !!ne.fulfilled;
  }

  // This check relies on the developer adding 'react-click' etc. handlers.
  // This is because we don't have a good way of check whether a react handler is actually bound or not.
  // - Does not follow portals, but native events don't follow portals either, so it shouldn't matter
  reactHandlerExists(event) {
    if (event.nativeEvent) {
      return false;
    }
    const cls = `.react-${event.type}`;
    let target = event.target;
    while (target && target !== event.currentTarget) {
      if (target.matches(cls)) {
        return true;
      }
      target = target.parentElement;
    }
    return false;
  }

  /* Returns whether we just fulfilled the event */
  // Always fulfill the native event (since react synthetic events are re-used)
  fulfill(event) {
    const ne = this.getNative(event);

    if (ne.fulfilled) {
      if (ne.fulfilled !== AWAIT_REACT || !event.nativeEvent) {
        // Already fulfilled, or waiting for a react handler
        return false;
      }
    } else if (this.options.supportReact && this.reactHandlerExists(event)) {
      // Wait for a react handler
      ne.fulfilled = AWAIT_REACT;
      return false;
    }

    ne.fulfilled = true;
    ne.fulfilledAt = event.currentTarget;
    this.register(event);
    return true;
  }

  // Fulfill a ghost event (but not "real" events). Returns whether it was fulfilled.
  // - Not stopping propagation or preventing default, as that may prevent clicks or other built in behaviour (e.g. focus).
  fulfillGhost(event) {
    const ne = this.getNative(event);
    if (ne.fulfilled) {
      return false;
    }
    if (this.isGhostMouse(event) || this.isGhostTouch(event)) {
      ne.fulfilled = true;
      return true;
    }
    return false;
  }

  // Get the native event (jQuery || React || native)
  getNative(event) {
    return event.originalEvent || event.nativeEvent || event;
  }

  isTouchEvent(event) {
    return /^touch/.test(event.type) || this.getNative(event).pointerType === 'touch';
  }

  isGhostMouse(event) {
    return /^mouse/.test(event.type) && (/^touch/.test(this.last.type) || /^pointer/.test(this.last.type));
  }

  isGhostTouch(event) {
    return /^touch/.test(event.type) && /^pointer/.test(this.last.type) && this.last.pointerType === 'touch';
  }

  deviceType(event) {
    if (/^pointer/.test(event.type)) {
      return event.pointerType || 'mouse';
    } else if (/^mouse/.test(event.type)) {
      return 'mouse';
    } else if (/^touch/.test(event.type)) {
      return 'touch';
    } else if (/^key/.test(event.type)) {
      return 'key';
    }
  }

  getOppositeType(type) {
    switch (type) {
      case 'pointerdown': return 'pointerup';
      case 'pointerup':   return 'pointerdown';
      case 'touchstart':  return 'touchend';
      case 'touchend':    return 'touchstart';
      case 'mousedown':   return 'mouseup';
      case 'mouseup':     return 'mousedown';
    }
  }

  register(event) {
    const ne = this.getNative(event);
    this.last = this.previous[event.type] = {
      type:          event.type,
      target:        event.target,
      currentTarget: event.currentTarget,
      fulfilled:     ne.fulfilled,
      fulfilledAt:   ne.fulfilledAt,
      pointerType:   ne.pointerType,
      timeStamp:     event.timeStamp,
      event,
    };
  }

  typeArray(typestring) {
    typeAssert(typestring, 'string');
    return typestring.split(this.options.typeSeparator).map(t => t.trim()).filter(t => t);
  }

  once(types, listener) {
    return this.on(types, listener, {once: true});
  }

  // typestring is a string in the format 'touchstart/mousedown'
  // listener is a function
  // options are the standard options supported by addEventListener()
  // Returns a function that unbinds the listeners.
  // If once is used, only this.off() will be able to unbind them. Otherwise removeEventListener works as well.
  on(typestring, listener, options={}) {
    typeAssert(listener, 'function');
    const { once, capture, passive } = options;
    // Cache the domNode in case it is forcibly changed
    const domNode = this.options.domNode;
    if (!domNode) {
      console.error('Inputhub domNode is not defined');
      return;
    }

    // Make sure we don't double-bind listeners
    this.off(typestring, listener);

    const types = this.typeArray(typestring);
    if (!types.length) {
      throw new Error('Got no type(s) to bind listener to');
    }

    // domListener and unbind depend on each other, but this is fine since they are both defined by the time either execute
    const domListener = !once ? listener : function domListener(event) {
      listener.call(this, event);
      unbind();
    };

    // Return an unbind function hat will unbind this specific binding.
    const unbind = () => types.forEach(type => {
      const data = this.listeners[type].get(listener);
      if (data && data.unbind === unbind) {
        domNode.removeEventListener(type, domListener);
        this.listeners[type].delete(listener);
      }
    });

    // Cache the domListener so that we can remove it later.
    const data = { domListener, unbind };

    types.forEach(type => {
      // We do "once" ourselves, combined over all types, but set passive if it is supported.
      // Note, passive defaults to true in chromium 55+ on touchstart and touchmove.
      const _options = !detectPassiveEvents.hasSupport ? !!capture : {
        capture: !!capture,
        passive: (passive != null) ? !!passive : this.options.passiveTypes.includes(type),
      };
      // Create weakmap for any type we haven't seen before.
      if (!this.listeners[type]) {
        this.listeners[type] = new WeakMap();
      }
      this.listeners[type].set(listener, data);
      domNode.addEventListener(type, domListener, _options);
    });

    return unbind;
  }

  off(typestring, listener) {
    typeAssert(listener, 'function');

    this.typeArray(typestring).forEach(type => {
      const data = this.listeners[type] && this.listeners[type].get(listener);
      if (!data) return;
      this.options.domNode.removeEventListener(type, data.domListener);
      this.listeners[type].delete(listener);
    });
  }
}

/* **************** */
/* Helper functions */
/* **************** */

function typeAssert(variable, type) {
  if (typeof variable === type) return;
  throw new TypeError(`Variable expected to be of type ${type}`);
}
