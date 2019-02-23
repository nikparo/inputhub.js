export default function listSeparator(list) {
  const passivecapture = [];
  const capture = [];
  const passive = [];
  const normal = [];
  list.forEach((obj) => {
    let ary;
    if (obj.passive && obj.capture) {
      ary = passivecapture;
    } else if (obj.capture) {
      ary = capture;
    } else if (obj.passive) {
      ary = passive;
    } else {
      ary = normal;
    }
    ary.push(obj.wrappedListener);
  });
  return {
    passivecapture, capture, passive, normal,
  };
}
