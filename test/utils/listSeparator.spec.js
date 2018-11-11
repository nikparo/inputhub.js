import listSeparator from '../../src/utils/listSeparator';

describe('listSeparator', () => {
  it('should separate an array of listener data objects by dom event options', () => {
    const empty = {
      passivecapture: [],
      capture: [],
      passive: [],
      normal: [],
    };
    const wrappedListener = () => {};

    expect(listSeparator([])).toEqual(empty);
    expect(listSeparator([{ wrappedListener }]))
      .toEqual({ ...empty, normal: [wrappedListener] });
    expect(listSeparator([{ wrappedListener, passive: true }]))
      .toEqual({ ...empty, passive: [wrappedListener] });
    expect(listSeparator([{ wrappedListener, capture: true }]))
      .toEqual({ ...empty, capture: [wrappedListener] });
    expect(listSeparator([{ wrappedListener, capture: true, passive: true }]))
      .toEqual({ ...empty, passivecapture: [wrappedListener] });
  });
});
