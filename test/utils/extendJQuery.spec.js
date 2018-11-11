import jQuery from 'jquery';
import { findJQuery, extendJQuery } from '../../src/utils/extendJQuery';

const gb = (typeof global !== 'undefined' && global) || (typeof window !== 'undefined' && window);
const $ = () => {};
const addedProps = ['fulfilled', 'fulfilledAt'];
// FIXME: Remove this whole thing since we use $event.originalEvent.fulfilled now!
// - Also jQuery discourages extending props, see https://github.com/jquery/api.jquery.com/issues/405
// const jQueryProps = jQuery.event.props.slice();
// const extendedProps = [...jQueryProps, ...addedProps];

describe('findJQuery', () => {
  it('should find jQuery if global', () => {

    expect(findJQuery()).toBe(null);
    gb.$ = $;
    expect(findJQuery()).toBe($);
    gb.jQuery = jQuery;
    expect(findJQuery()).toBe(jQuery);

    gb.jQuery = undefined;
    $.jQuery = undefined;
  });
});

describe('extendJQuery', () => {
  it('should add keys to given jQuery\'s events, unless they are found', () => {
    $.event = { props: [] };
    extendJQuery($);
    expect($.event.props).toEqual(addedProps);

    // extendJQuery(jQuery);
    // expect(jQuery.event.props).toEqual(extendedProps);
  });
});
