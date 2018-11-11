// This check relies on the developer adding 'react-click' etc. handlers,
// as we don't have a good way of check whether a react handler is actually bound or not.
// - This does not follow portals, but native events don't either, so it shouldn't matter
// - Stops at currentTarget, as no node should be managed by multiple frameworks

export default function reactHandlerExists(event) {
  if (event.nativeEvent) {
    // This is a synthetic event - there's no need to check
    return false;
  }
  const cls = ` react-${event.type} `;
  let { target } = event;
  while (target && target !== event.currentTarget) {
    if (` ${target.className} `.indexOf(cls) > -1) {
      return true;
    }
    target = target.parentElement;
  }
  return false;
}
