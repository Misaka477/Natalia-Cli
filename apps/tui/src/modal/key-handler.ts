export type ModalKeyHandler = (key: string) => boolean | void;

let current: ModalKeyHandler | undefined;

export function setModalKeyHandler(handler: ModalKeyHandler | undefined) {
  current = handler;
}

export function dispatchModalKey(key: string) {
  return current?.(key) === true;
}
