import InputHub from '../src/index';

describe('InputHub', () => {
  it('exposes the public API, .. and some extra :/', () => {
    const hub = new InputHub();
    const methods = Reflect.ownKeys(Object.getPrototypeOf(hub));

    expect(methods.length).toBe(16);
    expect(methods).toContain('getNative');
    expect(methods).toContain('deviceType');
    expect(methods).toContain('getOppositeType');
    expect(methods).toContain('isFulfilled');
    expect(methods).toContain('fulfill');
    expect(methods).toContain('fulfillGhost');
    expect(methods).toContain('isTouchEvent');
    expect(methods).toContain('isGhostMouse');
    expect(methods).toContain('isGhostTouch');
    expect(methods).toContain('register');
    expect(methods).toContain('getLast');
    expect(methods).toContain('once');
    expect(methods).toContain('on');
    expect(methods).toContain('off');
    /* extras */
    expect(methods).toContain('constructor');
    expect(methods).toContain('updateDomBindings');
  });

  it('has some own keys that should be private ...', () => {
    const hub = new InputHub();
    const keys = Object.keys(hub);

    expect(keys.length).toBe(5);
    expect(keys).toContain('last');
    expect(keys).toContain('previous');
    expect(keys).toContain('listeners');
    expect(keys).toContain('domListeners');
    expect(keys).toContain('options');
  });

  it('accepts options when created', () => {
    const hub = new InputHub({
      supportReact: false, // deprecated
      awaitReact: false,
      lifo: false,
      // savedProps(event, nativeEvent) {
      //   const { type } = event;
      //   const { target } = nativeEvent;
      //   return { type, target, foo: 'bar' };
      // },
    });

    expect(hub.options.supportReact).toBeUndefined();
    expect(hub.options.awaitReact).toBe(false);
    expect(hub.options.lifo).toBe(false);
  });

  // it('checks correctly whether an event is fulfilled', () => {
  //   const hub = new InputHub();
  // });
});
