import InputHub from '../src/index';

document.body.innerHTML = `
  <div id="container">
    <div id="inner">
      <button id="btn1" />
      <button id="btn2" />
    </div>
  </div>
`;

const btn1 = document.getElementById('btn1');
const btn2 = document.getElementById('btn2');

const triggerMouseEvent = (node, eventType) => {
  const event = new MouseEvent(eventType, {
    view: window,
    bubbles: true,
    cancelable: true,
  });
  node.dispatchEvent(event);
};

describe('InputHub', () => {
  it('exposes the public API, .. and some extra :/', () => {
    const hub = new InputHub();
    const methods = Reflect.ownKeys(Object.getPrototypeOf(hub));

    expect(methods.length).toBe(17);
    expect(methods).toContain('getNative');
    expect(methods).toContain('getDeviceType');
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
    expect(methods).toContain('offAll');
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
      supportReact: false, // deprecated & ignored
      awaitReact: false,
      lifo: false,
    });

    expect(hub.options.supportReact).toBeUndefined();
    expect(hub.options.awaitReact).toBe(false);
    expect(hub.options.lifo).toBe(false);
  });

  it('checks correctly whether an event is fulfilled', () => {
    const hub = new InputHub({
      domNode: document,
    });

    let event = null;
    let count = 0;
    let ignored = 0;
    const setEvent = (evt) => { event = evt; };
    const handleClick = (evt) => {
      if (!hub.fulfill(evt)) {
        ignored += 1;
        return;
      }
      count += 1;
    };

    btn1.addEventListener('click', handleClick);
    hub.on('click', handleClick);
    hub.on('click', hub.fulfill.bind(hub));
    hub.on('click/mousedown', setEvent);
    hub.on('mousedown', hub.register.bind(hub));

    btn1.click();
    expect(event.fulfilled).toBe(true);
    expect(event.fulfilledAt === btn1).toBe(true);
    expect(hub.isFulfilled(event)).toBe(true);
    expect(count).toBe(1);
    expect(ignored).toBe(1);

    triggerMouseEvent(btn1, 'mousedown');
    expect(event.fulfilled).toBeUndefined();
    expect(hub.isFulfilled(event)).toBe(false);

    btn1.removeEventListener('click', handleClick);
    hub.offAll();
  });

  it('keeps a history of one event per type', () => {
    const hub = new InputHub({
      domNode: document,
    });
    hub.on('click/mousedown', hub.fulfill.bind(hub));

    expect(hub.getLast()).toBe(null);
    expect(hub.getLast('click')).toBe(null);

    btn1.click();
    const last = hub.getLast();
    expect(last.type).toBe('click');
    expect(last.fulfilledAt === document).toBe(true);
    expect(last.currentTarget === document).toBe(true);
    expect(Object.keys(last)).toEqual([
      'type',
      'target',
      'currentTarget',
      'timeStamp',
      'fulfilled',
      'fulfilledAt',
      'pointerType',
      'defaultPrevented',
    ]);

    triggerMouseEvent(btn2, 'mousedown');
    expect(hub.getLast().type).toBe('mousedown');
    expect(hub.getLast('click') === last).toBe(true);

    hub.offAll();
  });

  it('executes listeners in the correct order', () => {
    const hub = new InputHub({
      domNode: document,
    });

    const eventArray = [];
    const push = str => () => eventArray.push(str);
    hub.on('click', push('1. normal'), { passive: false, capture: false });
    hub.on('click', push('2. normal (last in, first out)'), { passive: false, capture: false });
    hub.on('click', push('3. capture'), { passive: false, capture: true });
    hub.on('click', push('4. last in, last out'), { passive: false, capture: false, lifo: false });
    hub.on('click', push('5. passive'), { passive: true, capture: false });
    hub.on('click', push('6. passive lifo'), { passive: true, capture: false });

    expect(hub.listeners.click.filter().capture.length).toBe(1);
    expect(hub.listeners.click.filter().passivecapture.length).toBe(0);
    expect(hub.listeners.click.filter().passive.length).toBe(2);
    expect(hub.listeners.click.filter().normal.length).toBe(3);

    btn1.click();
    expect(eventArray).toEqual([
      '3. capture',
      '2. normal (last in, first out)',
      '1. normal',
      '4. last in, last out',
      '6. passive lifo',
      '5. passive',
    ]);
    hub.offAll();
  });

  it('executes once() only once', () => {
    const hub = new InputHub({
      domNode: document,
    });

    let count = 0;
    hub.once('click/mousedown', () => { count += 1; });

    btn1.click();
    btn1.click();
    triggerMouseEvent(btn1, 'mousedown');
    expect(count).toBe(1);

    hub.offAll();
  });
});
