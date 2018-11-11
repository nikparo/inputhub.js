/* eslint-disable no-undef */

export function findJQuery() {
  return (typeof jQuery === 'function' && jQuery) || (typeof $ === 'function' && $) || null;
}

export function extendJQuery(jQuery) {
  const jq = (typeof jQuery === 'function') ? jQuery : findJQuery();
  try {
    if (jq.event.props.indexOf('fulfilled') === -1) {
      jq.event.props.push('fulfilled');
    }
    if (jq.event.props.indexOf('fulfilledAt') === -1) {
      jq.event.props.push('fulfilledAt');
    }
    return true;
  } catch (e) {
    return false;
  }
}
