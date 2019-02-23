import reactHandlerExists from '../../src/utils/reactHandlerExists';

describe('reactHandlerExists', () => {
  it('should separate an array of listener data objects by dom event options', () => {
    const domTree = [
      'icon',
      'button react-click',
      'modal react-keydown',
      'container',
      'body main-app ',
      'document',
    ].map(className => ({ className }));

    // Link nodes to parents
    for (let i = 0; i < domTree.length; i += 1) {
      domTree[i].parentElement = domTree[i + 1];
    }

    const icon = domTree[0];
    const button = domTree[1];
    const reactButton = { ...button, className: 'button' };
    const container = domTree[3];
    const document = domTree.slice(-1)[0];

    expect(reactHandlerExists({
      type: 'click',
      target: icon,
      currentTarget: container,
    })).toBe(true);

    expect(reactHandlerExists({
      type: 'click',
      target: icon,
      currentTarget: button,
    })).toBe(false);

    expect(reactHandlerExists({
      type: 'click',
      target: reactButton,
      currentTarget: document,
      nativeEvent: {},
    })).toBe(false);

    expect(reactHandlerExists({
      type: 'mousedown',
      target: icon,
      currentTarget: button,
    })).toBe(false);

    expect(reactHandlerExists({
      type: 'keydown',
      target: button,
      currentTarget: document,
    })).toBe(true);

    expect(reactHandlerExists({
      type: 'keydown',
      target: container,
      currentTarget: document,
    })).toBe(false);
  });
});
