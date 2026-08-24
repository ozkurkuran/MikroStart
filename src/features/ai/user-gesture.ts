import {
  AiUserGestureRequiredError,
  type AiUserGestureTask,
} from "./types";

const issuedTasks = new WeakSet<object>();

interface UserActivationNavigator {
  userActivation?: { isActive: boolean };
}

/**
 * Call synchronously inside a trusted click/keyboard handler. Merely checking
 * capability availability must never call this function or start a download.
 */
export function createAiUserGestureTask(): AiUserGestureTask {
  const currentNavigator = globalThis.navigator as UserActivationNavigator | undefined;
  if (currentNavigator?.userActivation?.isActive !== true) {
    throw new AiUserGestureRequiredError();
  }

  const task = Object.freeze(Object.create(null)) as AiUserGestureTask;
  issuedTasks.add(task as object);
  return task;
}

export function consumeAiUserGestureTask(task: AiUserGestureTask): void {
  if (!issuedTasks.delete(task as object)) {
    throw new AiUserGestureRequiredError();
  }
}
