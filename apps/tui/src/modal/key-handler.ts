export type ModalKeyHandler = (key: string) => boolean | void;

let current: ModalKeyHandler | undefined;

export function setModalKeyHandler(handler: ModalKeyHandler | undefined) {
  current = handler;
  return () => {
    if (current === handler) current = undefined;
  };
}

export function dispatchModalKey(key: string) {
  return current?.(key) === true;
}
