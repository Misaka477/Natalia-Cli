export type ModalKeyHandler = (key: string) => boolean | void;

const handlers: ModalKeyHandler[] = [];

export function setModalKeyHandler(handler: ModalKeyHandler | undefined) {
  if (!handler) return () => {};
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

export function dispatchModalKey(key: string) {
  for (let index = handlers.length - 1; index >= 0; index--) {
    if (handlers[index]?.(key) === true) return true;
  }
  return false;
}
