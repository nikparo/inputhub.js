import typeArray from '../../src/utils/typeArray';

describe('typeArray', () => {
  it('should split a string of event types into an array', () => {
    const separator = new RegExp(' |/');

    expect(typeArray(' click  mousedown', separator)).toEqual(['click', 'mousedown']);
    expect(typeArray('click/mousedown/keydown', separator)).toEqual(['click', 'mousedown', 'keydown']);
  });

  it('throws if typestring is not a string', () => {
    expect(() => typeArray(() => {})).toThrow();
    expect(() => typeArray(3)).toThrow();
    expect(() => typeArray({})).toThrow();
    expect(() => typeArray('')).not.toThrow();
  });
});
